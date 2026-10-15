-- =====================================================
-- Migration: V20250101_0005__booking.sql
-- Description: Booking Module - Core business logic tables
-- Tables: booking, passenger, seat_allocation
-- Dependencies: Identity & Access, Trains/Stations/Routes, Fares modules
-- =====================================================

-- =====================================================
-- Table: booking
-- Description: Main booking entity representing a ticket reservation
-- =====================================================
CREATE TABLE booking (
    pnr VARCHAR(10) PRIMARY KEY,
    user_id INTEGER NOT NULL,
    run_id INTEGER NOT NULL,
    class_code VARCHAR(3) NOT NULL,
    quota_code VARCHAR(10) NOT NULL,
    from_seq INTEGER NOT NULL,
    to_seq INTEGER NOT NULL,
    total_fare DECIMAL(10, 2) NOT NULL,
    status booking_status_enum NOT NULL DEFAULT 'HELD',
    hold_expires_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT fk_booking_user FOREIGN KEY (user_id) 
        REFERENCES users(user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_booking_run FOREIGN KEY (run_id) 
        REFERENCES train_run(run_id) ON DELETE RESTRICT,
    CONSTRAINT fk_booking_class FOREIGN KEY (class_code) 
        REFERENCES travel_class(class_code) ON DELETE RESTRICT,
    CONSTRAINT fk_booking_quota FOREIGN KEY (quota_code) 
        REFERENCES quota(quota_code) ON DELETE RESTRICT,
    
    -- Business Rules
    CONSTRAINT chk_booking_segment CHECK (from_seq < to_seq),
    CONSTRAINT chk_booking_total_fare CHECK (total_fare >= 0),
    CONSTRAINT chk_booking_hold_expiry CHECK (
        (status = 'HELD' AND hold_expires_at IS NOT NULL) OR
        (status != 'HELD' AND hold_expires_at IS NULL)
    )
);

-- Indexes for booking
CREATE INDEX idx_booking_user ON booking(user_id);
CREATE INDEX idx_booking_run ON booking(run_id);
CREATE INDEX idx_booking_run_class_quota ON booking(run_id, class_code, quota_code);
CREATE INDEX idx_booking_status ON booking(status);
CREATE INDEX idx_booking_hold_expires ON booking(hold_expires_at) 
    WHERE status = 'HELD';

COMMENT ON TABLE booking IS 'Main booking entity representing a ticket reservation';
COMMENT ON COLUMN booking.pnr IS 'Passenger Name Record - unique booking identifier';
COMMENT ON COLUMN booking.from_seq IS 'Starting station sequence number on the route';
COMMENT ON COLUMN booking.to_seq IS 'Ending station sequence number on the route';
COMMENT ON COLUMN booking.hold_expires_at IS 'Expiry time for HELD bookings (NULL for confirmed/cancelled)';

-- =====================================================
-- Table: passenger
-- Description: Individual passengers within a booking
-- =====================================================
CREATE TABLE passenger (
    passenger_id SERIAL PRIMARY KEY,
    pnr VARCHAR(10) NOT NULL,
    concession_id INTEGER,
    name VARCHAR(100) NOT NULL,
    age INTEGER NOT NULL,
    gender CHAR(1) NOT NULL,
    status passenger_status_enum NOT NULL DEFAULT 'WAITLIST',
    queue_no INTEGER,
    passenger_fare DECIMAL(10, 2) NOT NULL,
    cancelled_at TIMESTAMP,
    
    -- Constraints
    CONSTRAINT fk_passenger_booking FOREIGN KEY (pnr) 
        REFERENCES booking(pnr) ON DELETE CASCADE,
    CONSTRAINT fk_passenger_concession FOREIGN KEY (concession_id) 
        REFERENCES concession_rule(concession_id) ON DELETE SET NULL,
    
    -- Business Rules
    CONSTRAINT chk_passenger_age CHECK (age > 0 AND age <= 120),
    CONSTRAINT chk_passenger_gender CHECK (gender IN ('M', 'F', 'O')),
    CONSTRAINT chk_passenger_fare CHECK (passenger_fare >= 0),
    CONSTRAINT chk_passenger_queue_no CHECK (
        (status IN ('RAC', 'WAITLIST') AND queue_no IS NOT NULL) OR
        (status NOT IN ('RAC', 'WAITLIST') AND queue_no IS NULL)
    ),
    CONSTRAINT chk_passenger_cancelled_at CHECK (
        (status = 'CANCELLED' AND cancelled_at IS NOT NULL) OR
        (status != 'CANCELLED' AND cancelled_at IS NULL)
    )
);

-- Indexes for passenger
CREATE INDEX idx_passenger_pnr ON passenger(pnr);
CREATE INDEX idx_passenger_status ON passenger(status);
CREATE INDEX idx_passenger_queue_no ON passenger(queue_no) 
    WHERE status IN ('RAC', 'WAITLIST');

COMMENT ON TABLE passenger IS 'Individual passengers within a booking (max 6 per PNR)';
COMMENT ON COLUMN passenger.queue_no IS 'Position in RAC or waitlist queue (NULL for confirmed)';
COMMENT ON COLUMN passenger.passenger_fare IS 'Fare for this passenger after concessions';

-- =====================================================
-- Table: seat_allocation
-- Description: Seat assignments for confirmed passengers
-- =====================================================
CREATE TABLE seat_allocation (
    allocation_id SERIAL PRIMARY KEY,
    passenger_id INTEGER NOT NULL UNIQUE,
    seat_id INTEGER NOT NULL,
    run_id INTEGER NOT NULL,
    from_seq INTEGER NOT NULL,
    to_seq INTEGER NOT NULL,
    
    -- Constraints
    CONSTRAINT fk_seat_allocation_passenger FOREIGN KEY (passenger_id) 
        REFERENCES passenger(passenger_id) ON DELETE CASCADE,
    CONSTRAINT fk_seat_allocation_seat FOREIGN KEY (seat_id) 
        REFERENCES seat(seat_id) ON DELETE RESTRICT,
    CONSTRAINT fk_seat_allocation_run FOREIGN KEY (run_id) 
        REFERENCES train_run(run_id) ON DELETE RESTRICT,
    
    -- Business Rules
    CONSTRAINT chk_seat_allocation_segment CHECK (from_seq < to_seq)
);

-- Indexes for seat_allocation
CREATE INDEX idx_seat_allocation_passenger ON seat_allocation(passenger_id);
CREATE INDEX idx_seat_allocation_seat_run ON seat_allocation(seat_id, run_id);
CREATE INDEX idx_seat_allocation_run ON seat_allocation(run_id);

COMMENT ON TABLE seat_allocation IS 'Seat assignments for confirmed passengers (one allocation per passenger)';
COMMENT ON COLUMN seat_allocation.passenger_id IS 'Unique - each passenger can have only one seat allocation';
COMMENT ON COLUMN seat_allocation.from_seq IS 'Segment start (should match passenger booking segment)';
COMMENT ON COLUMN seat_allocation.to_seq IS 'Segment end (should match passenger booking segment)';

-- =====================================================
-- Migration complete
-- =====================================================
