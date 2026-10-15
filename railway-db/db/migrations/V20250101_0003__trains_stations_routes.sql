-- Migration: V20250101_0003__trains_stations_routes.sql
-- Description: Create Trains, Stations & Routes module tables (9 tables)
-- Tables: station, train, travel_class, route, route_station, train_schedule, train_run, train_coach, seat
-- Date: 2025-01-01
-- Author: Railway Reservation System Team

-- =====================================================================
-- TRAINS, STATIONS & ROUTES MODULE (9 TABLES)
-- =====================================================================
-- This module handles the railway network infrastructure
-- Dependencies: train_type_enum (from previous migration)

-- ---------------------------------------------------------------------
-- TABLE: station
-- Purpose: Railway stations across the network
-- Key: Natural key (station_code)
-- ---------------------------------------------------------------------
CREATE TABLE station (
    station_code VARCHAR(10) PRIMARY KEY,
    station_name VARCHAR(200) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    zone VARCHAR(50),
    num_platforms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_station_num_platforms 
        CHECK (num_platforms IS NULL OR num_platforms > 0)
);

COMMENT ON TABLE station IS 'Railway stations in the network';
COMMENT ON COLUMN station.station_code IS 'Unique station code (e.g., NDLS, BCT, MAS)';
COMMENT ON COLUMN station.station_name IS 'Full station name';
COMMENT ON COLUMN station.city IS 'City where station is located';
COMMENT ON COLUMN station.state IS 'State/province';
COMMENT ON COLUMN station.zone IS 'Railway zone (e.g., Northern, Western)';
COMMENT ON COLUMN station.num_platforms IS 'Number of platforms';

CREATE INDEX idx_station_city ON station(city);
CREATE INDEX idx_station_state ON station(state);

-- ---------------------------------------------------------------------
-- TABLE: train
-- Purpose: Train entities (physical trains, not runs)
-- Key: Natural key (train_no)
-- ---------------------------------------------------------------------
CREATE TABLE train (
    train_no VARCHAR(10) PRIMARY KEY,
    train_name VARCHAR(200) NOT NULL,
    train_type train_type_enum NOT NULL DEFAULT 'Express',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE train IS 'Train entities (not specific runs/schedules)';
COMMENT ON COLUMN train.train_no IS 'Unique train number (e.g., 12345)';
COMMENT ON COLUMN train.train_name IS 'Train name (e.g., Rajdhani Express)';
COMMENT ON COLUMN train.train_type IS 'Train type: Express, Slow, or High-Speed';
COMMENT ON COLUMN train.is_active IS 'Whether train is currently in service';

CREATE INDEX idx_train_type ON train(train_type);
CREATE INDEX idx_train_active ON train(is_active);

-- ---------------------------------------------------------------------
-- TABLE: travel_class
-- Purpose: Travel classes available (1A, 2A, 3A, SL, etc.)
-- Key: Natural key (class_code)
-- ---------------------------------------------------------------------
CREATE TABLE travel_class (
    class_code VARCHAR(10) PRIMARY KEY,
    class_name VARCHAR(100) NOT NULL,
    is_ac BOOLEAN NOT NULL DEFAULT FALSE,
    seats_per_coach INTEGER NOT NULL,
    base_fare_per_km NUMERIC(10,2) NOT NULL,
    reservation_charge NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_travel_class_seats 
        CHECK (seats_per_coach > 0),
    
    CONSTRAINT chk_travel_class_base_fare 
        CHECK (base_fare_per_km > 0),
    
    CONSTRAINT chk_travel_class_reservation_charge 
        CHECK (reservation_charge >= 0)
);

COMMENT ON TABLE travel_class IS 'Travel classes (1A, 2A, 3A, SL, 2S, etc.)';
COMMENT ON COLUMN travel_class.class_code IS 'Unique class code (e.g., 1A, 2A, SL)';
COMMENT ON COLUMN travel_class.class_name IS 'Full class name (e.g., First AC, Sleeper)';
COMMENT ON COLUMN travel_class.is_ac IS 'Whether class is air-conditioned';
COMMENT ON COLUMN travel_class.seats_per_coach IS 'Standard seats per coach';
COMMENT ON COLUMN travel_class.base_fare_per_km IS 'Base fare per kilometer';
COMMENT ON COLUMN travel_class.reservation_charge IS 'Fixed reservation charge';

-- ---------------------------------------------------------------------
-- TABLE: route
-- Purpose: Named routes connecting multiple stations
-- ---------------------------------------------------------------------
CREATE TABLE route (
    route_id SERIAL PRIMARY KEY,
    route_code VARCHAR(20) NOT NULL UNIQUE,
    route_name VARCHAR(200) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE route IS 'Named routes (derived data: origin, destination, distance from route_station)';
COMMENT ON COLUMN route.route_id IS 'Primary key';
COMMENT ON COLUMN route.route_code IS 'Unique route code';
COMMENT ON COLUMN route.route_name IS 'Route name (e.g., Delhi-Mumbai via Jaipur)';

-- ---------------------------------------------------------------------
-- TABLE: route_station
-- Purpose: Ordered list of stations on a route with timing/distance info
-- Key: Composite (route_id, stop_seq)
-- ---------------------------------------------------------------------
CREATE TABLE route_station (
    route_id INTEGER NOT NULL,
    stop_seq INTEGER NOT NULL,
    station_code VARCHAR(10) NOT NULL,
    distance_km NUMERIC(10,2) NOT NULL,
    arrival_offset INTEGER,
    departure_offset INTEGER NOT NULL,
    day_offset INTEGER NOT NULL DEFAULT 0,
    default_platform VARCHAR(10),
    
    PRIMARY KEY (route_id, stop_seq),
    
    CONSTRAINT fk_route_station_route 
        FOREIGN KEY (route_id) 
        REFERENCES route(route_id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_route_station_station 
        FOREIGN KEY (station_code) 
        REFERENCES station(station_code) 
        ON DELETE RESTRICT,
    
    CONSTRAINT chk_route_station_stop_seq 
        CHECK (stop_seq > 0),
    
    CONSTRAINT chk_route_station_distance 
        CHECK (distance_km >= 0),
    
    CONSTRAINT chk_route_station_day_offset 
        CHECK (day_offset >= 0),
    
    CONSTRAINT chk_route_station_offsets 
        CHECK (arrival_offset IS NULL OR arrival_offset >= 0),
    
    CONSTRAINT chk_route_station_departure 
        CHECK (departure_offset >= 0)
);

COMMENT ON TABLE route_station IS 'Ordered stops on a route with timing and distance';
COMMENT ON COLUMN route_station.route_id IS 'Reference to route';
COMMENT ON COLUMN route_station.stop_seq IS 'Sequence number (1, 2, 3, ...)';
COMMENT ON COLUMN route_station.station_code IS 'Station at this stop';
COMMENT ON COLUMN route_station.distance_km IS 'Distance from origin (km)';
COMMENT ON COLUMN route_station.arrival_offset IS 'Minutes from origin (NULL for first station)';
COMMENT ON COLUMN route_station.departure_offset IS 'Departure minutes from origin';
COMMENT ON COLUMN route_station.day_offset IS 'Days from origin (0 = same day)';
COMMENT ON COLUMN route_station.default_platform IS 'Default platform number';

CREATE INDEX idx_route_station_route_id ON route_station(route_id);
CREATE INDEX idx_route_station_station_code ON route_station(station_code);

-- ---------------------------------------------------------------------
-- TABLE: train_schedule
-- Purpose: Maps trains to routes on specific weekdays
-- Key: Composite (train_no, run_day)
-- ---------------------------------------------------------------------
CREATE TABLE train_schedule (
    train_no VARCHAR(10) NOT NULL,
    run_day VARCHAR(10) NOT NULL,
    route_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (train_no, run_day),
    
    CONSTRAINT fk_train_schedule_train 
        FOREIGN KEY (train_no) 
        REFERENCES train(train_no) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_train_schedule_route 
        FOREIGN KEY (route_id) 
        REFERENCES route(route_id) 
        ON DELETE RESTRICT,
    
    CONSTRAINT chk_train_schedule_run_day 
        CHECK (run_day IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'))
);

COMMENT ON TABLE train_schedule IS 'Which route a train runs on each weekday';
COMMENT ON COLUMN train_schedule.train_no IS 'Train reference';
COMMENT ON COLUMN train_schedule.run_day IS 'Day of week';
COMMENT ON COLUMN train_schedule.route_id IS 'Route for this day';

CREATE INDEX idx_train_schedule_train_no ON train_schedule(train_no);
CREATE INDEX idx_train_schedule_route_id ON train_schedule(route_id);

-- ---------------------------------------------------------------------
-- TABLE: train_run
-- Purpose: Dated instance of a train (specific departure)
-- Note: Route is derived from train_schedule, not stored
-- ---------------------------------------------------------------------
CREATE TABLE train_run (
    run_id SERIAL PRIMARY KEY,
    train_no VARCHAR(10) NOT NULL,
    run_date DATE NOT NULL,
    status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_train_run_train 
        FOREIGN KEY (train_no) 
        REFERENCES train(train_no) 
        ON DELETE RESTRICT,
    
    CONSTRAINT uq_train_run_train_date 
        UNIQUE (train_no, run_date)
);

COMMENT ON TABLE train_run IS 'Dated instance of a train (route derived via train_schedule)';
COMMENT ON COLUMN train_run.run_id IS 'Primary key';
COMMENT ON COLUMN train_run.train_no IS 'Train reference';
COMMENT ON COLUMN train_run.run_date IS 'Date of this run';
COMMENT ON COLUMN train_run.status IS 'Run status (domain unspecified in schema)';

CREATE INDEX idx_train_run_train_no ON train_run(train_no);
CREATE INDEX idx_train_run_date ON train_run(run_date);
CREATE INDEX idx_train_run_train_date ON train_run(train_no, run_date);

-- ---------------------------------------------------------------------
-- TABLE: train_coach
-- Purpose: Coaches of a train and their travel class
-- Key: Composite (train_no, coach_no)
-- ---------------------------------------------------------------------
CREATE TABLE train_coach (
    train_no VARCHAR(10) NOT NULL,
    coach_no VARCHAR(10) NOT NULL,
    class_code VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (train_no, coach_no),
    
    CONSTRAINT fk_train_coach_train 
        FOREIGN KEY (train_no) 
        REFERENCES train(train_no) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_train_coach_class 
        FOREIGN KEY (class_code) 
        REFERENCES travel_class(class_code) 
        ON DELETE RESTRICT
);

COMMENT ON TABLE train_coach IS 'Coaches of a train and their travel class';
COMMENT ON COLUMN train_coach.train_no IS 'Train reference';
COMMENT ON COLUMN train_coach.coach_no IS 'Coach number (e.g., A1, B2, S3)';
COMMENT ON COLUMN train_coach.class_code IS 'Travel class of this coach';

CREATE INDEX idx_train_coach_train_no ON train_coach(train_no);
CREATE INDEX idx_train_coach_class_code ON train_coach(class_code);

-- ---------------------------------------------------------------------
-- TABLE: seat
-- Purpose: Physical seats/berths in coaches
-- ---------------------------------------------------------------------
CREATE TABLE seat (
    seat_id SERIAL PRIMARY KEY,
    train_no VARCHAR(10) NOT NULL,
    coach_no VARCHAR(10) NOT NULL,
    berth_no VARCHAR(10) NOT NULL,
    berth_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_seat_coach 
        FOREIGN KEY (train_no, coach_no) 
        REFERENCES train_coach(train_no, coach_no) 
        ON DELETE CASCADE,
    
    CONSTRAINT uq_seat_train_coach_berth 
        UNIQUE (train_no, coach_no, berth_no)
);

COMMENT ON TABLE seat IS 'Physical seats/berths in train coaches';
COMMENT ON COLUMN seat.seat_id IS 'Primary key';
COMMENT ON COLUMN seat.train_no IS 'Train reference';
COMMENT ON COLUMN seat.coach_no IS 'Coach reference';
COMMENT ON COLUMN seat.berth_no IS 'Berth/seat number (e.g., 1, 2, 3)';
COMMENT ON COLUMN seat.berth_type IS 'Berth type (e.g., Lower, Middle, Upper, Window, Aisle)';

CREATE INDEX idx_seat_train_coach ON seat(train_no, coach_no);

-- =====================================================================
-- VERIFICATION
-- =====================================================================
DO $$
DECLARE
    table_count INTEGER;
    rec RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== Trains, Stations & Routes Module Created ===';
    RAISE NOTICE '';
    
    -- Count tables created
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('station', 'train', 'travel_class', 'route', 'route_station', 
                       'train_schedule', 'train_run', 'train_coach', 'seat');
    
    RAISE NOTICE 'Tables created: %', table_count;
    RAISE NOTICE '';
    
    -- List tables
    FOR rec IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('station', 'train', 'travel_class', 'route', 'route_station', 
                           'train_schedule', 'train_run', 'train_coach', 'seat')
        ORDER BY table_name
    LOOP
        RAISE NOTICE '  - %', rec.table_name;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE 'Module: Trains, Stations & Routes';
    RAISE NOTICE 'Status: ✓ Complete';
    RAISE NOTICE '';
END $$;
