-- =====================================================================
-- C3 Booking — 06: booking procedures
--
--   create_booking(...)      -> pnr      hold seats / RAC / waitlist
--   confirm_booking(pnr)     -> fare     HELD -> CONFIRMED (Team 4, on payment)
--   cancel_passengers(...)   -> rows     cancel some or all passengers
--   CALL promote_queue(...)              RAC -> CONFIRMED, WAITLIST -> CONFIRMED/RAC
--   CALL expire_holds(...)               unpaid holds past expiry -> EXPIRED
--
-- Concurrency: everything that hands out seats or queue places for a
-- (run, class) first takes a transaction-level advisory lock on that pair,
-- so two bookings for the last seat are served one after the other. The
-- no-overlap exclusion constraint (05) is the backstop.
--
-- Errors use standard SQLSTATEs the API maps to HTTP codes:
--   no_data_found (P0002) -> 404, invalid_parameter_value (22023) -> 422,
--   object_not_in_prerequisite_state (55000) -> 409,
--   insufficient_privilege (42501) -> 403, check_violation (23514) -> 422
-- =====================================================================

CREATE FUNCTION hold_minutes() RETURNS INTEGER
LANGUAGE sql IMMUTABLE AS $$ SELECT 15 $$;

COMMENT ON FUNCTION hold_minutes() IS 'How long an unpaid booking holds its seats';

-- Serialise seat/queue changes for one run and class (released at commit)
CREATE FUNCTION lock_run_class(p_run_id INTEGER, p_class_code VARCHAR) RETURNS void
LANGUAGE sql AS $$
    SELECT pg_advisory_xact_lock(p_run_id, hashtext('c3:' || p_class_code))
$$;

-- Best free seat for a passenger of a booking, or NULL:
-- coaches where the PNR already sits first, lower berths first for 60+
CREATE FUNCTION pick_seat(p_pnr VARCHAR, p_age INTEGER) RETURNS INTEGER
LANGUAGE sql STABLE AS $$
    SELECT f.seat_id
    FROM booking b
    CROSS JOIN LATERAL free_seats(b.run_id, b.class_code, b.from_seq, b.to_seq) f
    WHERE b.pnr = p_pnr
    ORDER BY
        NOT EXISTS (SELECT 1 FROM seat_allocation sa
                    JOIN passenger p ON p.passenger_id = sa.passenger_id
                    JOIN seat s ON s.seat_id = sa.seat_id
                    WHERE p.pnr = p_pnr AND s.coach_no = f.coach_no),
        CASE WHEN p_age >= 60 AND f.berth_type IN ('LB', 'SL') THEN 0 ELSE 1 END,
        f.coach_no, length(f.berth_no), f.berth_no
    LIMIT 1
$$;

-- Give a passenger a seat if one is free; returns TRUE if it did
CREATE FUNCTION try_confirm_passenger(p_passenger_id INTEGER) RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
    p RECORD;
    v_seat INTEGER;
BEGIN
    SELECT ps.pnr, ps.age, b.run_id, b.from_seq, b.to_seq INTO p
    FROM passenger ps JOIN booking b ON b.pnr = ps.pnr
    WHERE ps.passenger_id = p_passenger_id;

    v_seat := pick_seat(p.pnr, p.age);
    IF v_seat IS NULL THEN
        RETURN FALSE;
    END IF;
    UPDATE passenger SET status = 'CONFIRMED', queue_no = NULL WHERE passenger_id = p_passenger_id;
    INSERT INTO seat_allocation (passenger_id, seat_id, run_id, from_seq, to_seq)
    VALUES (p_passenger_id, v_seat, p.run_id, p.from_seq, p.to_seq);
    RETURN TRUE;
END $$;

-- ---------------------------------------------------------------------
-- create_booking
--   p_passengers: JSON array of 1-6 objects
--     {"name": "Asha Rao", "age": 34, "gender": "F", "concession_id": null}
--   Each passenger gets a seat if one is free for the whole journey,
--   otherwise an RAC place if any is left, otherwise a waitlist place.
--   The booking is HELD for hold_minutes() awaiting payment.
-- ---------------------------------------------------------------------
CREATE FUNCTION create_booking(p_user_id INTEGER, p_run_id INTEGER, p_class_code VARCHAR,
                               p_quota_code VARCHAR, p_from_seq INTEGER, p_to_seq INTEGER,
                               p_passengers JSONB) RETURNS VARCHAR(10)
LANGUAGE plpgsql AS $$
DECLARE
    v_user_status user_status_enum;
    v_run         train_run%ROWTYPE;
    v_pnr         VARCHAR(10);
    v_count       INTEGER;
    v_fare        NUMERIC;
    v_id          INTEGER;
    x             RECORD;
BEGIN
    -- who and what
    SELECT status INTO v_user_status FROM users WHERE user_id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'user % not found', p_user_id USING ERRCODE = 'no_data_found';
    ELSIF v_user_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'user % is % and cannot book', p_user_id, v_user_status USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT * INTO v_run FROM train_run WHERE run_id = p_run_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'train run % not found', p_run_id USING ERRCODE = 'no_data_found';
    ELSIF v_run.status IN ('CANCELLED', 'ARRIVED') THEN
        -- run status is Team 2's (train-service); DEPARTED still takes bookings for later stops
        RAISE EXCEPTION 'train run % is %', p_run_id, lower(v_run.status) USING ERRCODE = 'object_not_in_prerequisite_state';
    END IF;
    IF journey_date(p_run_id, p_from_seq) < CURRENT_DATE THEN
        RAISE EXCEPTION 'the train has already left stop %', p_from_seq USING ERRCODE = 'object_not_in_prerequisite_state';
    END IF;

    IF p_passengers IS NULL OR jsonb_typeof(p_passengers) <> 'array' THEN
        RAISE EXCEPTION 'passengers must be a JSON array' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    v_count := jsonb_array_length(p_passengers);
    IF v_count NOT BETWEEN 1 AND 6 THEN
        RAISE EXCEPTION 'a booking needs 1 to 6 passengers, got %', v_count USING ERRCODE = 'invalid_parameter_value';
    END IF;

    PERFORM lock_run_class(p_run_id, p_class_code);

    -- the booking row (validated by trg_booking_validate); total_fare is
    -- filled in by the passenger trigger
    v_pnr := generate_pnr();
    INSERT INTO booking (pnr, user_id, run_id, class_code, quota_code, from_seq, to_seq,
                         total_fare, status, hold_expires_at)
    VALUES (v_pnr, p_user_id, p_run_id, p_class_code, p_quota_code, p_from_seq, p_to_seq,
            0, 'HELD', now() + make_interval(mins => hold_minutes()));

    FOR x IN
        SELECT * FROM jsonb_to_recordset(p_passengers)
            AS t(name TEXT, age INTEGER, gender TEXT, concession_id INTEGER)
    LOOP
        v_fare := calc_fare(p_run_id, p_class_code, p_quota_code, p_from_seq, p_to_seq, x.concession_id);

        -- every passenger starts on the waitlist, then moves up if possible
        INSERT INTO passenger (pnr, concession_id, name, age, gender, status, queue_no, passenger_fare)
        VALUES (v_pnr, x.concession_id, x.name, x.age, x.gender, 'WAITLIST',
                next_queue_no(p_run_id, p_class_code, p_quota_code, 'WAITLIST'), v_fare)
        RETURNING passenger_id INTO v_id;

        IF NOT try_confirm_passenger(v_id)
           AND queued_count(p_run_id, p_class_code, 'RAC', p_from_seq, p_to_seq) < rac_capacity(p_run_id, p_class_code) THEN
            UPDATE passenger
            SET status = 'RAC', queue_no = next_queue_no(p_run_id, p_class_code, p_quota_code, 'RAC')
            WHERE passenger_id = v_id;
        END IF;
    END LOOP;

    RETURN v_pnr;
END $$;

-- ---------------------------------------------------------------------
-- confirm_booking: payment succeeded. Idempotent, so Team 4's verify call
-- and webhook can both call it. Returns the amount the booking costs.
-- ---------------------------------------------------------------------
CREATE FUNCTION confirm_booking(p_pnr VARCHAR) RETURNS NUMERIC
LANGUAGE plpgsql AS $$
DECLARE
    b booking%ROWTYPE;
BEGIN
    SELECT * INTO b FROM booking WHERE pnr = p_pnr FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PNR % not found', p_pnr USING ERRCODE = 'no_data_found';
    END IF;
    IF b.status = 'CONFIRMED' THEN
        RETURN b.total_fare;
    END IF;
    IF b.status <> 'HELD' THEN
        RAISE EXCEPTION 'PNR % is % and cannot be confirmed', p_pnr, b.status
            USING ERRCODE = 'object_not_in_prerequisite_state';
    END IF;
    IF b.hold_expires_at < now() THEN
        RAISE EXCEPTION 'PNR %: the payment hold expired at %', p_pnr, b.hold_expires_at
            USING ERRCODE = 'object_not_in_prerequisite_state';
    END IF;
    UPDATE booking SET status = 'CONFIRMED', hold_expires_at = NULL WHERE pnr = p_pnr;
    RETURN b.total_fare;
END $$;

-- ---------------------------------------------------------------------
-- promote_queue: after seats or RAC places free up on a run and class.
-- RAC passengers are offered seats first, then the waitlist gets seats or
-- RAC places. Each queue is served by queue number (queues of different
-- quotas interleave by position); a passenger moves up only if a seat or
-- RAC place is free for their whole journey.
-- ---------------------------------------------------------------------
CREATE PROCEDURE promote_queue(p_run_id INTEGER, p_class_code VARCHAR)
LANGUAGE plpgsql AS $$
DECLARE
    q RECORD;
BEGIN
    PERFORM lock_run_class(p_run_id, p_class_code);

    FOR q IN
        SELECT p.passenger_id
        FROM passenger p JOIN booking b ON b.pnr = p.pnr
        WHERE b.run_id = p_run_id AND b.class_code = p_class_code
          AND b.status IN ('HELD', 'CONFIRMED') AND p.status = 'RAC'
        ORDER BY p.queue_no, p.passenger_id
    LOOP
        PERFORM try_confirm_passenger(q.passenger_id);
    END LOOP;

    FOR q IN
        SELECT p.passenger_id, b.quota_code, b.from_seq, b.to_seq
        FROM passenger p JOIN booking b ON b.pnr = p.pnr
        WHERE b.run_id = p_run_id AND b.class_code = p_class_code
          AND b.status IN ('HELD', 'CONFIRMED') AND p.status = 'WAITLIST'
        ORDER BY p.queue_no, p.passenger_id
    LOOP
        IF NOT try_confirm_passenger(q.passenger_id)
           AND queued_count(p_run_id, p_class_code, 'RAC', q.from_seq, q.to_seq) < rac_capacity(p_run_id, p_class_code) THEN
            UPDATE passenger
            SET status = 'RAC', queue_no = next_queue_no(p_run_id, p_class_code, q.quota_code, 'RAC')
            WHERE passenger_id = q.passenger_id;
        END IF;
    END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- cancel_passengers: cancel the given passengers of a PNR (all of them
-- when p_passenger_ids is NULL). Frees their seats/queue places, cancels
-- the booking once nobody is left, then promotes the queue.
-- Returns one row per cancelled passenger so Team 4 can work out the
-- refund (nothing was paid if booking_was_paid is FALSE).
-- ---------------------------------------------------------------------
CREATE FUNCTION cancel_passengers(p_pnr VARCHAR, p_passenger_ids INTEGER[] DEFAULT NULL)
RETURNS TABLE (passenger_id INTEGER, passenger_fare NUMERIC, previous_status passenger_status_enum,
               booking_was_paid BOOLEAN)
LANGUAGE plpgsql AS $$
#variable_conflict use_column
DECLARE
    b booking%ROWTYPE;
    v_bad INTEGER;
BEGIN
    SELECT * INTO b FROM booking WHERE pnr = p_pnr FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PNR % not found', p_pnr USING ERRCODE = 'no_data_found';
    END IF;
    IF b.status NOT IN ('HELD', 'CONFIRMED') THEN
        RAISE EXCEPTION 'PNR % is % and cannot be cancelled', p_pnr, b.status
            USING ERRCODE = 'object_not_in_prerequisite_state';
    END IF;
    IF journey_date(b.run_id, b.from_seq) < CURRENT_DATE THEN
        RAISE EXCEPTION 'PNR %: the train has already left', p_pnr
            USING ERRCODE = 'object_not_in_prerequisite_state';
    END IF;
    IF p_passenger_ids IS NOT NULL THEN
        IF cardinality(p_passenger_ids) = 0 THEN
            RAISE EXCEPTION 'no passengers given' USING ERRCODE = 'invalid_parameter_value';
        END IF;
        SELECT id INTO v_bad FROM unnest(p_passenger_ids) AS id
        WHERE NOT EXISTS (SELECT 1 FROM passenger p
                          WHERE p.passenger_id = id AND p.pnr = p_pnr AND p.status <> 'CANCELLED')
        LIMIT 1;
        IF FOUND THEN
            RAISE EXCEPTION 'passenger % is not an active passenger of PNR %', v_bad, p_pnr
                USING ERRCODE = 'invalid_parameter_value';
        END IF;
    END IF;

    PERFORM lock_run_class(b.run_id, b.class_code);

    DELETE FROM seat_allocation sa
    USING passenger p
    WHERE sa.passenger_id = p.passenger_id AND p.pnr = p_pnr AND p.status <> 'CANCELLED'
      AND (p_passenger_ids IS NULL OR p.passenger_id = ANY (p_passenger_ids));

    RETURN QUERY
    UPDATE passenger p
    SET status = 'CANCELLED', queue_no = NULL, cancelled_at = now()
    FROM passenger old
    WHERE old.passenger_id = p.passenger_id
      AND p.pnr = p_pnr AND p.status <> 'CANCELLED'
      AND (p_passenger_ids IS NULL OR p.passenger_id = ANY (p_passenger_ids))
    RETURNING p.passenger_id, p.passenger_fare, old.status, b.status = 'CONFIRMED';

    IF NOT EXISTS (SELECT 1 FROM passenger p WHERE p.pnr = p_pnr AND p.status <> 'CANCELLED') THEN
        UPDATE booking SET status = 'CANCELLED', hold_expires_at = NULL WHERE pnr = p_pnr;
    END IF;

    CALL promote_queue(b.run_id, b.class_code);
END $$;

-- ---------------------------------------------------------------------
-- expire_holds: run every minute by the booking service. Unpaid bookings
-- past hold_expires_at become EXPIRED, their passengers CANCELLED, and the
-- freed seats go to the queue. Rows locked by a concurrent payment are
-- skipped and picked up next time.
-- ---------------------------------------------------------------------
CREATE PROCEDURE expire_holds(INOUT expired_count INTEGER DEFAULT 0)
LANGUAGE plpgsql AS $$
DECLARE
    b RECORD;
BEGIN
    expired_count := 0;
    FOR b IN
        SELECT pnr, run_id, class_code FROM booking
        WHERE status = 'HELD' AND hold_expires_at < now()
        ORDER BY hold_expires_at
        FOR UPDATE SKIP LOCKED
    LOOP
        PERFORM lock_run_class(b.run_id, b.class_code);
        DELETE FROM seat_allocation sa USING passenger p
        WHERE sa.passenger_id = p.passenger_id AND p.pnr = b.pnr;
        UPDATE passenger SET status = 'CANCELLED', queue_no = NULL, cancelled_at = now()
        WHERE pnr = b.pnr AND status <> 'CANCELLED';
        UPDATE booking SET status = 'EXPIRED', hold_expires_at = NULL WHERE pnr = b.pnr;
        CALL promote_queue(b.run_id, b.class_code);
        expired_count := expired_count + 1;
    END LOOP;
END $$;
