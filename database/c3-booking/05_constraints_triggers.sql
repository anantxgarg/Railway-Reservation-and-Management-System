-- =====================================================================
-- C3 Booking — 05: cross-row constraints and triggers
--
-- Rules a single-row CHECK cannot express. Every rejection raises
-- SQLSTATE 23514 (check_violation) with a CONSTRAINT name, so callers and
-- tests can tell which rule failed.
-- =====================================================================

-- ---------------------------------------------------------------------
-- No double booking: a seat can't be held twice on overlapping parts of
-- the same run. [1,3) and [3,4) don't overlap, so a berth freed at stop 3
-- can be sold onwards from stop 3.
-- ---------------------------------------------------------------------
ALTER TABLE seat_allocation ADD CONSTRAINT excl_seat_allocation_no_overlap
    EXCLUDE USING gist (seat_id WITH =, run_id WITH =, int4range(from_seq, to_seq) WITH &&);

-- ---------------------------------------------------------------------
-- booking: valid journey on insert
--   both stops are on the run's route and the train has the class
-- ---------------------------------------------------------------------
CREATE FUNCTION trg_booking_validate() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_route INTEGER := route_of_run(NEW.run_id);
BEGIN
    IF NOT EXISTS (SELECT 1 FROM train_run WHERE run_id = NEW.run_id) THEN
        RETURN NEW;  -- fk_booking_run reports it
    END IF;
    IF v_route IS NULL THEN
        RAISE EXCEPTION 'run % has no schedule for its weekday', NEW.run_id
            USING ERRCODE = 'check_violation', CONSTRAINT = 'trg_booking_valid_stops';
    END IF;
    IF (SELECT count(*) FROM route_station
        WHERE route_id = v_route AND stop_seq IN (NEW.from_seq, NEW.to_seq)) <> 2 THEN
        RAISE EXCEPTION 'stops % and % are not both on the route of run %', NEW.from_seq, NEW.to_seq, NEW.run_id
            USING ERRCODE = 'check_violation', CONSTRAINT = 'trg_booking_valid_stops';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM train_run r JOIN train_coach tc ON tc.train_no = r.train_no
                   WHERE r.run_id = NEW.run_id AND tc.class_code = NEW.class_code) THEN
        RAISE EXCEPTION 'the train of run % has no % coach', NEW.run_id, NEW.class_code
            USING ERRCODE = 'check_violation', CONSTRAINT = 'trg_booking_class_on_train';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_booking_validate
    BEFORE INSERT ON booking
    FOR EACH ROW EXECUTE FUNCTION trg_booking_validate();

-- ---------------------------------------------------------------------
-- booking: journey fields are fixed after insert; status only moves
--   HELD -> CONFIRMED | CANCELLED | EXPIRED,  CONFIRMED -> CANCELLED
-- ---------------------------------------------------------------------
CREATE FUNCTION trg_booking_guard_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF (NEW.pnr, NEW.user_id, NEW.run_id, NEW.class_code, NEW.quota_code, NEW.from_seq, NEW.to_seq, NEW.created_at)
       IS DISTINCT FROM
       (OLD.pnr, OLD.user_id, OLD.run_id, OLD.class_code, OLD.quota_code, OLD.from_seq, OLD.to_seq, OLD.created_at) THEN
        RAISE EXCEPTION 'booking %: journey details cannot be changed; cancel and rebook instead', OLD.pnr
            USING ERRCODE = 'check_violation', CONSTRAINT = 'trg_booking_immutable';
    END IF;
    IF NEW.status <> OLD.status AND NOT (
           (OLD.status = 'HELD' AND NEW.status IN ('CONFIRMED', 'CANCELLED', 'EXPIRED'))
        OR (OLD.status = 'CONFIRMED' AND NEW.status = 'CANCELLED')) THEN
        RAISE EXCEPTION 'booking %: status cannot change from % to %', OLD.pnr, OLD.status, NEW.status
            USING ERRCODE = 'check_violation', CONSTRAINT = 'trg_booking_status_flow';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_booking_guard_update
    BEFORE UPDATE ON booking
    FOR EACH ROW EXECUTE FUNCTION trg_booking_guard_update();

-- ---------------------------------------------------------------------
-- passenger: added only while the booking is HELD, at most 6 per PNR
-- (the booking row is locked so two concurrent inserts can't both pass)
-- ---------------------------------------------------------------------
CREATE FUNCTION trg_passenger_before_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_status booking_status_enum;
BEGIN
    SELECT status INTO v_status FROM booking WHERE pnr = NEW.pnr FOR UPDATE;
    IF NOT FOUND THEN
        RETURN NEW;  -- fk_passenger_booking reports it
    END IF;
    IF v_status <> 'HELD' THEN
        RAISE EXCEPTION 'booking %: passengers can only be added while it is HELD (it is %)', NEW.pnr, v_status
            USING ERRCODE = 'check_violation', CONSTRAINT = 'trg_passenger_booking_held';
    END IF;
    IF (SELECT count(*) FROM passenger WHERE pnr = NEW.pnr) >= 6 THEN
        RAISE EXCEPTION 'booking %: at most 6 passengers per PNR', NEW.pnr
            USING ERRCODE = 'check_violation', CONSTRAINT = 'trg_passenger_max_six';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_passenger_before_insert
    BEFORE INSERT ON passenger
    FOR EACH ROW EXECUTE FUNCTION trg_passenger_before_insert();

-- ---------------------------------------------------------------------
-- passenger: PNR is fixed; status only moves forward
--   WAITLIST -> RAC | CONFIRMED | CANCELLED,  RAC -> CONFIRMED | CANCELLED,
--   CONFIRMED -> CANCELLED
-- ---------------------------------------------------------------------
CREATE FUNCTION trg_passenger_guard_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.pnr <> OLD.pnr THEN
        RAISE EXCEPTION 'passenger %: cannot move to another PNR', OLD.passenger_id
            USING ERRCODE = 'check_violation', CONSTRAINT = 'trg_passenger_immutable';
    END IF;
    IF NEW.status <> OLD.status AND NOT (
           (OLD.status = 'WAITLIST' AND NEW.status IN ('RAC', 'CONFIRMED', 'CANCELLED'))
        OR (OLD.status = 'RAC' AND NEW.status IN ('CONFIRMED', 'CANCELLED'))
        OR (OLD.status = 'CONFIRMED' AND NEW.status = 'CANCELLED')) THEN
        RAISE EXCEPTION 'passenger %: status cannot change from % to %', OLD.passenger_id, OLD.status, NEW.status
            USING ERRCODE = 'check_violation', CONSTRAINT = 'trg_passenger_status_flow';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_passenger_guard_update
    BEFORE UPDATE ON passenger
    FOR EACH ROW EXECUTE FUNCTION trg_passenger_guard_update();

-- ---------------------------------------------------------------------
-- booking.total_fare = sum of passenger_fare, kept up to date
-- ---------------------------------------------------------------------
CREATE FUNCTION trg_passenger_sync_total() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_pnr VARCHAR(10) := CASE WHEN TG_OP = 'DELETE' THEN OLD.pnr ELSE NEW.pnr END;
BEGIN
    UPDATE booking
    SET total_fare = (SELECT coalesce(sum(passenger_fare), 0) FROM passenger WHERE pnr = v_pnr)
    WHERE pnr = v_pnr;
    RETURN NULL;
END $$;

CREATE TRIGGER trg_passenger_sync_total
    AFTER INSERT OR DELETE OR UPDATE OF passenger_fare ON passenger
    FOR EACH ROW EXECUTE FUNCTION trg_passenger_sync_total();

-- ---------------------------------------------------------------------
-- seat_allocation must match its booking: same run and segment, a seat
-- of that run's train in the booked class, for a CONFIRMED passenger
-- ---------------------------------------------------------------------
CREATE FUNCTION trg_seat_allocation_validate() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    b RECORD;
BEGIN
    SELECT bk.run_id, bk.class_code, bk.from_seq, bk.to_seq, p.status, r.train_no
    INTO b
    FROM passenger p
    JOIN booking bk ON bk.pnr = p.pnr
    JOIN train_run r ON r.run_id = bk.run_id
    WHERE p.passenger_id = NEW.passenger_id;
    IF NOT FOUND THEN
        RETURN NEW;  -- fk_seat_allocation_passenger reports it
    END IF;
    IF (NEW.run_id, NEW.from_seq, NEW.to_seq) IS DISTINCT FROM (b.run_id, b.from_seq, b.to_seq) THEN
        RAISE EXCEPTION 'allocation for passenger % must use the booking''s run and stops', NEW.passenger_id
            USING ERRCODE = 'check_violation', CONSTRAINT = 'trg_seat_allocation_matches_booking';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM seat s
                   JOIN train_coach tc ON tc.train_no = s.train_no AND tc.coach_no = s.coach_no
                   WHERE s.seat_id = NEW.seat_id AND s.train_no = b.train_no AND tc.class_code = b.class_code) THEN
        RAISE EXCEPTION 'seat % is not a % seat on train %', NEW.seat_id, b.class_code, b.train_no
            USING ERRCODE = 'check_violation', CONSTRAINT = 'trg_seat_allocation_matches_booking';
    END IF;
    IF b.status <> 'CONFIRMED' THEN
        RAISE EXCEPTION 'passenger % is %, only CONFIRMED passengers get a seat', NEW.passenger_id, b.status
            USING ERRCODE = 'check_violation', CONSTRAINT = 'trg_seat_allocation_confirmed_only';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_seat_allocation_validate
    BEFORE INSERT OR UPDATE ON seat_allocation
    FOR EACH ROW EXECUTE FUNCTION trg_seat_allocation_validate();

-- ---------------------------------------------------------------------
-- A passenger is CONFIRMED exactly when they have a seat_allocation.
-- Checked at COMMIT (deferred), because a status change and its
-- allocation insert/delete are separate statements.
-- ---------------------------------------------------------------------
CREATE FUNCTION trg_confirmed_has_seat() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_id     INTEGER := CASE WHEN TG_TABLE_NAME = 'passenger' THEN NEW.passenger_id ELSE OLD.passenger_id END;
    v_status passenger_status_enum;
BEGIN
    SELECT status INTO v_status FROM passenger WHERE passenger_id = v_id;
    IF FOUND AND (v_status = 'CONFIRMED') <> EXISTS (SELECT 1 FROM seat_allocation WHERE passenger_id = v_id) THEN
        RAISE EXCEPTION 'passenger % is % but % a seat allocation', v_id, v_status,
            CASE WHEN v_status = 'CONFIRMED' THEN 'has no' ELSE 'still has' END
            USING ERRCODE = 'check_violation', CONSTRAINT = 'chk_confirmed_has_seat';
    END IF;
    RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER chk_confirmed_has_seat
    AFTER INSERT OR UPDATE OF status ON passenger
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION trg_confirmed_has_seat();

CREATE CONSTRAINT TRIGGER chk_confirmed_has_seat
    AFTER DELETE OR UPDATE OF passenger_id ON seat_allocation
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION trg_confirmed_has_seat();
