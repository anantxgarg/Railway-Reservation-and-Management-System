-- =====================================================================
-- C3 Booking — 08: notifications for Team 6 (transactional outbox)
--
-- Team 6's notification service (notification-service/, MongoDB) shows
-- users what happened to their bookings. Events are written here, in the
-- same transaction as the change they describe, and booking-service
-- delivers them to Team 6 (POST /api/notifications) afterwards. So a
-- notification is sent only if the change was committed, and a change
-- never fails because Team 6's service is down.
--
-- Who writes what (data fields are Team 6's, see NotificationType.java):
--   BOOKING_CONFIRMED   trigger: booking HELD -> CONFIRMED (paid)
--   WL_TO_RAC,          trigger: a passenger of an existing booking moves
--   RAC_TO_CNF            up the queue (promote_queue)
--   BOOKING_CANCELLED   booking-service (unpaid) and payments (paid, with
--                         the refund) via queue_notification()
--   PAYMENT_CONFIRMED   payments via queue_notification()
--   JOURNEY_REMINDER    booking-service's job via queue_journey_reminders()
--   JOURNEY_COMPLETED   train-service, when staff mark a run ARRIVED, via
--                         queue_journey_completed()
-- =====================================================================

CREATE TABLE notification_outbox (
    event_id BIGSERIAL PRIMARY KEY,
    type VARCHAR(30) NOT NULL,
    user_id INTEGER NOT NULL,
    pnr VARCHAR(10) NOT NULL,
    source_team VARCHAR(30) NOT NULL,
    data JSONB NOT NULL,
    event_time TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    sent_at TIMESTAMPTZ,

    CONSTRAINT fk_outbox_booking
        FOREIGN KEY (pnr) REFERENCES booking(pnr) ON DELETE CASCADE,
    CONSTRAINT chk_outbox_type CHECK (type IN (
        'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'PAYMENT_CONFIRMED', 'JOURNEY_REMINDER',
        'WL_TO_RAC', 'RAC_TO_CNF', 'JOURNEY_COMPLETED')),
    CONSTRAINT chk_outbox_attempts CHECK (attempts >= 0)
);

COMMENT ON TABLE notification_outbox IS 'Notifications for Team 6, written with the change they describe and delivered by booking-service';
COMMENT ON COLUMN notification_outbox.data IS 'The "data" object of Team 6''s POST /api/notifications for this type';
COMMENT ON COLUMN notification_outbox.sent_at IS 'When Team 6 accepted it; NULL while waiting or retrying';

CREATE INDEX idx_outbox_unsent ON notification_outbox(event_id) WHERE sent_at IS NULL;

-- one reminder and one "journey completed" per booking, however often the
-- job runs or staff set the run status
CREATE UNIQUE INDEX uq_outbox_once_per_booking ON notification_outbox(pnr, type)
    WHERE type IN ('JOURNEY_REMINDER', 'JOURNEY_COMPLETED');

-- ---------------------------------------------------------------------
-- queue_notification: add one event for the owner of a PNR
-- ---------------------------------------------------------------------
CREATE FUNCTION queue_notification(p_type VARCHAR, p_pnr VARCHAR, p_source_team VARCHAR, p_data JSONB)
RETURNS BIGINT
LANGUAGE plpgsql AS $$
DECLARE
    v_id BIGINT;
BEGIN
    INSERT INTO notification_outbox (type, user_id, pnr, source_team, data)
    SELECT p_type, b.user_id, b.pnr, p_source_team, p_data
    FROM booking b WHERE b.pnr = p_pnr
    RETURNING event_id INTO v_id;
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'PNR % not found', p_pnr USING ERRCODE = 'no_data_found';
    END IF;
    RETURN v_id;
END $$;

-- Coach and seat of a passenger as Team 6 shows them: the berth when
-- confirmed, otherwise the queue ("RAC" / "4")
CREATE FUNCTION notification_seat(p_passenger_id INTEGER, OUT coach TEXT, OUT seat TEXT)
LANGUAGE sql STABLE AS $$
    SELECT coalesce(v.coach_no, CASE v.passenger_status WHEN 'RAC' THEN 'RAC' ELSE 'WL' END),
           coalesce(v.berth_no, v.current_position::TEXT, '-')
    FROM v_pnr_status v WHERE v.passenger_id = p_passenger_id
$$;

-- Clock time "HH:MM" of a timestamp in India
CREATE FUNCTION ist_hhmm(p_at TIMESTAMPTZ) RETURNS TEXT
LANGUAGE sql STABLE AS $$
    SELECT to_char(p_at AT TIME ZONE 'Asia/Kolkata', 'HH24:MI')
$$;

-- ---------------------------------------------------------------------
-- BOOKING_CONFIRMED: when a booking is paid
--   bookingStatus is CNF, RAC or WL when every passenger is in the same
--   state, PARTIAL otherwise
-- ---------------------------------------------------------------------
CREATE FUNCTION trg_notify_booking_confirmed() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM queue_notification('BOOKING_CONFIRMED', NEW.pnr, 'team-3', jsonb_build_object(
        'trainNumber', v.train_no,
        'trainName', v.train_name,
        'journeyDate', v.journey_date::TEXT,
        'fromStation', v.from_station,
        'toStation', v.to_station,
        'travelClass', v.class_code,
        'passengerCount', count(*),
        'bookingStatus', CASE
            WHEN bool_and(v.passenger_status = 'CONFIRMED') THEN 'CNF'
            WHEN bool_and(v.passenger_status = 'RAC') THEN 'RAC'
            WHEN bool_and(v.passenger_status = 'WAITLIST') THEN 'WL'
            ELSE 'PARTIAL' END))
    FROM v_pnr_status v
    WHERE v.pnr = NEW.pnr AND v.passenger_status <> 'CANCELLED'
    GROUP BY v.train_no, v.train_name, v.journey_date, v.from_station, v.to_station, v.class_code;
    RETURN NULL;
END $$;

CREATE TRIGGER trg_notify_booking_confirmed
    AFTER UPDATE OF status ON booking
    FOR EACH ROW
    WHEN (OLD.status = 'HELD' AND NEW.status = 'CONFIRMED')
    EXECUTE FUNCTION trg_notify_booking_confirmed();

-- ---------------------------------------------------------------------
-- WL_TO_RAC / RAC_TO_CNF: a passenger moves up the queue
--   Deferred to COMMIT, because try_confirm_passenger writes the seat
--   after the status. Passengers placed while their booking is being
--   created (same transaction as the booking) are not "promoted".
--   A waitlisted passenger who gets a berth directly is RAC_TO_CNF too,
--   with oldStatus "WL n". oldStatus is the number the passenger was given
--   when queued, newStatus the position now, as on the PNR status page.
-- ---------------------------------------------------------------------
CREATE FUNCTION trg_notify_passenger_promoted() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_old_label TEXT := CASE OLD.status WHEN 'RAC' THEN 'RAC ' ELSE 'WL ' END || OLD.queue_no;
    v_seat RECORD;
BEGIN
    IF (SELECT created_at FROM booking WHERE pnr = NEW.pnr) >= now()      -- booked in this transaction
       OR (SELECT status FROM passenger WHERE passenger_id = NEW.passenger_id) IS DISTINCT FROM NEW.status THEN
        RETURN NULL;                                                      -- moved again or cancelled since
    END IF;

    IF NEW.status = 'RAC' THEN
        PERFORM queue_notification('WL_TO_RAC', NEW.pnr, 'team-3', jsonb_build_object(
            'passengerName', NEW.name,
            'oldStatus', v_old_label,
            'newStatus', (SELECT status_label FROM v_pnr_status WHERE passenger_id = NEW.passenger_id)));
    ELSE
        v_seat := notification_seat(NEW.passenger_id);
        PERFORM queue_notification('RAC_TO_CNF', NEW.pnr, 'team-3', jsonb_build_object(
            'passengerName', NEW.name,
            'oldStatus', v_old_label,
            'coach', v_seat.coach,
            'seat', v_seat.seat));
    END IF;
    RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER trg_notify_passenger_promoted
    AFTER UPDATE OF status ON passenger
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    WHEN (OLD.status IN ('WAITLIST', 'RAC') AND NEW.status IN ('RAC', 'CONFIRMED') AND OLD.status <> NEW.status)
    EXECUTE FUNCTION trg_notify_passenger_promoted();

-- ---------------------------------------------------------------------
-- queue_journey_reminders: JOURNEY_REMINDER for paid bookings whose
-- train leaves the boarding stop within p_within. Once per booking.
-- Returns how many were queued. Called by booking-service's job.
-- ---------------------------------------------------------------------
CREATE FUNCTION queue_journey_reminders(p_within INTERVAL DEFAULT INTERVAL '24 hours') RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
    v_count INTEGER;
BEGIN
    INSERT INTO notification_outbox (type, user_id, pnr, source_team, data)
    SELECT 'JOURNEY_REMINDER', b.user_id, b.pnr, 'team-3', jsonb_build_object(
               'trainNumber', v.train_no,
               'trainName', v.train_name,
               'journeyDate', v.journey_date::TEXT,
               'departureTime', ist_hhmm(d.departs),
               'boardingStation', v.from_station,
               'coach', s.coach,
               'seat', s.seat)
    FROM booking b
    CROSS JOIN LATERAL (SELECT stop_departure_at(b.run_id, b.from_seq) AS departs) d
    JOIN train_run r ON r.run_id = b.run_id
    -- the first passenger still travelling
    JOIN LATERAL (SELECT * FROM v_pnr_status v
                  WHERE v.pnr = b.pnr AND v.passenger_status <> 'CANCELLED'
                  ORDER BY v.passenger_id LIMIT 1) v ON TRUE
    CROSS JOIN LATERAL notification_seat(v.passenger_id) s
    WHERE b.status = 'CONFIRMED'
      AND r.status NOT IN ('CANCELLED', 'ARRIVED')
      AND d.departs BETWEEN now() AND now() + p_within
    ON CONFLICT (pnr, type) WHERE type IN ('JOURNEY_REMINDER', 'JOURNEY_COMPLETED') DO NOTHING;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END $$;

-- ---------------------------------------------------------------------
-- queue_journey_completed: JOURNEY_COMPLETED for every paid booking on a
-- run, which opens Team 6's feedback form. Once per booking. Returns how
-- many were queued. Called by train-service when a run is marked ARRIVED.
-- ---------------------------------------------------------------------
CREATE FUNCTION queue_journey_completed(p_run_id INTEGER) RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
    v_count INTEGER;
BEGIN
    INSERT INTO notification_outbox (type, user_id, pnr, source_team, data)
    SELECT 'JOURNEY_COMPLETED', b.user_id, b.pnr, 'team-2', jsonb_build_object(
               'trainNumber', v.train_no,
               'trainName', v.train_name,
               'journeyDate', v.journey_date::TEXT,
               'fromStation', v.from_station,
               'toStation', v.to_station,
               'departureTime', ist_hhmm(stop_departure_at(b.run_id, b.from_seq)),
               'arrivalTime', ist_hhmm(stop_arrival_at(b.run_id, b.to_seq)),
               'passengerName', v.name,
               'coach', s.coach,
               'seat', s.seat)
    FROM booking b
    JOIN LATERAL (SELECT * FROM v_pnr_status v
                  WHERE v.pnr = b.pnr AND v.passenger_status <> 'CANCELLED'
                  ORDER BY v.passenger_id LIMIT 1) v ON TRUE
    CROSS JOIN LATERAL notification_seat(v.passenger_id) s
    WHERE b.run_id = p_run_id AND b.status = 'CONFIRMED'
    ON CONFLICT (pnr, type) WHERE type IN ('JOURNEY_REMINDER', 'JOURNEY_COMPLETED') DO NOTHING;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END $$;
