-- =====================================================================
-- C3 Booking — 03: booking, passenger, seat_allocation (Team 3)
--
-- Depends on: users (C1), train_run / travel_class / seat (01),
--             quota / concession_rule (02)
-- Cross-row rules (no double booking, max 6 passengers, seat matches
-- booking, fare totals) are added in 04_constraints_triggers.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- booking
-- ---------------------------------------------------------------------
CREATE TABLE booking (
    pnr VARCHAR(10) PRIMARY KEY,
    user_id INTEGER NOT NULL,
    run_id INTEGER NOT NULL,
    class_code VARCHAR(10) NOT NULL,
    quota_code VARCHAR(10) NOT NULL,
    from_seq INTEGER NOT NULL,
    to_seq INTEGER NOT NULL,
    total_fare NUMERIC(10,2) NOT NULL,
    status booking_status_enum NOT NULL DEFAULT 'HELD',
    hold_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_booking_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_booking_run FOREIGN KEY (run_id)
        REFERENCES train_run(run_id) ON DELETE RESTRICT,
    CONSTRAINT fk_booking_class FOREIGN KEY (class_code)
        REFERENCES travel_class(class_code) ON DELETE RESTRICT,
    CONSTRAINT fk_booking_quota FOREIGN KEY (quota_code)
        REFERENCES quota(quota_code) ON DELETE RESTRICT,

    CONSTRAINT chk_booking_segment CHECK (from_seq < to_seq),
    CONSTRAINT chk_booking_total_fare CHECK (total_fare >= 0),
    CONSTRAINT chk_booking_hold_expiry CHECK (
        (status = 'HELD' AND hold_expires_at IS NOT NULL) OR
        (status <> 'HELD' AND hold_expires_at IS NULL)
    )
);

CREATE INDEX idx_booking_user ON booking(user_id);
CREATE INDEX idx_booking_run_class_quota ON booking(run_id, class_code, quota_code);
CREATE INDEX idx_booking_status ON booking(status);
CREATE INDEX idx_booking_hold_expires ON booking(hold_expires_at) WHERE status = 'HELD';

COMMENT ON TABLE booking IS 'One reservation, identified by its PNR';
COMMENT ON COLUMN booking.pnr IS 'Passenger Name Record - unique booking identifier';
COMMENT ON COLUMN booking.user_id IS 'Customer who made the booking (C1 users)';
COMMENT ON COLUMN booking.from_seq IS 'Boarding stop: route_station.stop_seq of the run''s route';
COMMENT ON COLUMN booking.to_seq IS 'Alighting stop: route_station.stop_seq of the run''s route';
COMMENT ON COLUMN booking.total_fare IS 'Sum of passenger_fare over the PNR''s passengers';
COMMENT ON COLUMN booking.hold_expires_at IS 'When an unpaid HELD booking expires (NULL otherwise)';

-- ---------------------------------------------------------------------
-- passenger
-- ---------------------------------------------------------------------
CREATE TABLE passenger (
    passenger_id SERIAL PRIMARY KEY,
    pnr VARCHAR(10) NOT NULL,
    concession_id INTEGER,
    name VARCHAR(100) NOT NULL,
    age INTEGER NOT NULL,
    gender CHAR(1) NOT NULL,
    status passenger_status_enum NOT NULL,
    queue_no INTEGER,
    passenger_fare NUMERIC(10,2) NOT NULL,
    cancelled_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT fk_passenger_booking FOREIGN KEY (pnr)
        REFERENCES booking(pnr) ON DELETE CASCADE,
    CONSTRAINT fk_passenger_concession FOREIGN KEY (concession_id)
        REFERENCES concession_rule(concession_id) ON DELETE SET NULL,

    CONSTRAINT chk_passenger_name CHECK (btrim(name) <> ''),
    CONSTRAINT chk_passenger_age CHECK (age > 0 AND age <= 120),
    CONSTRAINT chk_passenger_gender CHECK (gender IN ('M', 'F', 'O')),
    CONSTRAINT chk_passenger_fare CHECK (passenger_fare >= 0),
    CONSTRAINT chk_passenger_queue_no CHECK (
        (status IN ('RAC', 'WAITLIST') AND queue_no IS NOT NULL AND queue_no > 0) OR
        (status NOT IN ('RAC', 'WAITLIST') AND queue_no IS NULL)
    ),
    CONSTRAINT chk_passenger_cancelled_at CHECK (
        (status = 'CANCELLED' AND cancelled_at IS NOT NULL) OR
        (status <> 'CANCELLED' AND cancelled_at IS NULL)
    )
);

CREATE INDEX idx_passenger_pnr ON passenger(pnr);
CREATE INDEX idx_passenger_queue ON passenger(status, queue_no) WHERE status IN ('RAC', 'WAITLIST');

COMMENT ON TABLE passenger IS 'A traveller on a PNR (at most 6 per PNR)';
COMMENT ON COLUMN passenger.queue_no IS 'Position in the RAC or waitlist queue of (run, class, quota); NULL otherwise';
COMMENT ON COLUMN passenger.passenger_fare IS 'Fare for this passenger after quota and concession';

-- ---------------------------------------------------------------------
-- seat_allocation
-- ---------------------------------------------------------------------
CREATE TABLE seat_allocation (
    allocation_id SERIAL PRIMARY KEY,
    passenger_id INTEGER NOT NULL UNIQUE,
    seat_id INTEGER NOT NULL,
    run_id INTEGER NOT NULL,
    from_seq INTEGER NOT NULL,
    to_seq INTEGER NOT NULL,

    CONSTRAINT fk_seat_allocation_passenger FOREIGN KEY (passenger_id)
        REFERENCES passenger(passenger_id) ON DELETE CASCADE,
    CONSTRAINT fk_seat_allocation_seat FOREIGN KEY (seat_id)
        REFERENCES seat(seat_id) ON DELETE RESTRICT,
    CONSTRAINT fk_seat_allocation_run FOREIGN KEY (run_id)
        REFERENCES train_run(run_id) ON DELETE RESTRICT,

    CONSTRAINT chk_seat_allocation_segment CHECK (from_seq < to_seq)
);

CREATE INDEX idx_seat_allocation_run ON seat_allocation(run_id);

COMMENT ON TABLE seat_allocation IS 'Physical seat assigned to a CONFIRMED passenger for a journey segment';
COMMENT ON COLUMN seat_allocation.run_id IS 'Deliberate copy of booking.run_id, needed by the no-overlap constraint';
COMMENT ON COLUMN seat_allocation.from_seq IS 'Deliberate copy of booking.from_seq';
COMMENT ON COLUMN seat_allocation.to_seq IS 'Deliberate copy of booking.to_seq';
