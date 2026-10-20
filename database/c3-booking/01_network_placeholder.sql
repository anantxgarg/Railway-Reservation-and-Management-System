-- =====================================================================
-- C3 Booking — 01: network tables (PLACEHOLDER — owned by Team 2)
--
-- Team 2 (Trains, Stations, Routes) owns these 9 tables but has not
-- started yet. Booking cannot work without them, so Team 3 keeps this
-- copy, written to match schema_relational.dbml. When Team 2 starts,
-- they should take this file over (e.g. move it to database/c2-network/)
-- instead of writing a second version.
--
-- Tables: station, train, travel_class, route, route_station,
--         train_schedule, train_run, train_coach, seat
-- =====================================================================

-- ---------------------------------------------------------------------
-- station
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
COMMENT ON COLUMN station.zone IS 'Railway zone (e.g., Northern, Western)';

CREATE INDEX idx_station_city ON station(city);

-- ---------------------------------------------------------------------
-- train
-- ---------------------------------------------------------------------
CREATE TABLE train (
    train_no VARCHAR(10) PRIMARY KEY,
    train_name VARCHAR(200) NOT NULL,
    train_type train_type_enum NOT NULL DEFAULT 'Express',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE train IS 'Train entities (not specific runs/schedules)';
COMMENT ON COLUMN train.train_no IS 'Unique train number (e.g., 12301)';

-- ---------------------------------------------------------------------
-- travel_class
-- ---------------------------------------------------------------------
CREATE TABLE travel_class (
    class_code VARCHAR(10) PRIMARY KEY,
    class_name VARCHAR(100) NOT NULL,
    is_ac BOOLEAN NOT NULL DEFAULT FALSE,
    seats_per_coach INTEGER NOT NULL,
    base_fare_per_km NUMERIC(10,2) NOT NULL,
    reservation_charge NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_travel_class_seats CHECK (seats_per_coach > 0),
    CONSTRAINT chk_travel_class_base_fare CHECK (base_fare_per_km > 0),
    CONSTRAINT chk_travel_class_reservation_charge CHECK (reservation_charge >= 0)
);

COMMENT ON TABLE travel_class IS 'Travel classes (1A, 2A, 3A, SL, 2S, etc.)';
COMMENT ON COLUMN travel_class.base_fare_per_km IS 'Base fare per kilometre';
COMMENT ON COLUMN travel_class.reservation_charge IS 'Fixed reservation charge per passenger';

-- ---------------------------------------------------------------------
-- route
-- ---------------------------------------------------------------------
CREATE TABLE route (
    route_id SERIAL PRIMARY KEY,
    route_code VARCHAR(20) NOT NULL UNIQUE,
    route_name VARCHAR(200) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE route IS 'Named routes (origin, destination, distance derived from route_station)';

-- ---------------------------------------------------------------------
-- route_station
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
        FOREIGN KEY (route_id) REFERENCES route(route_id) ON DELETE CASCADE,
    CONSTRAINT fk_route_station_station
        FOREIGN KEY (station_code) REFERENCES station(station_code) ON DELETE RESTRICT,

    CONSTRAINT chk_route_station_stop_seq CHECK (stop_seq > 0),
    CONSTRAINT chk_route_station_distance CHECK (distance_km >= 0),
    CONSTRAINT chk_route_station_day_offset CHECK (day_offset >= 0),
    CONSTRAINT chk_route_station_offsets CHECK (arrival_offset IS NULL OR arrival_offset >= 0),
    CONSTRAINT chk_route_station_departure CHECK (departure_offset >= 0)
);

COMMENT ON TABLE route_station IS 'Ordered stops on a route with timing and distance';
COMMENT ON COLUMN route_station.stop_seq IS 'Sequence number (1, 2, 3, ...); booking.from_seq/to_seq refer to it';
COMMENT ON COLUMN route_station.distance_km IS 'Distance from origin (km)';
COMMENT ON COLUMN route_station.arrival_offset IS 'Minutes from origin departure (NULL for first station)';
COMMENT ON COLUMN route_station.departure_offset IS 'Departure minutes from origin departure';

CREATE INDEX idx_route_station_station_code ON route_station(station_code);

-- ---------------------------------------------------------------------
-- train_schedule
-- ---------------------------------------------------------------------
CREATE TABLE train_schedule (
    train_no VARCHAR(10) NOT NULL,
    run_day VARCHAR(10) NOT NULL,
    route_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (train_no, run_day),

    CONSTRAINT fk_train_schedule_train
        FOREIGN KEY (train_no) REFERENCES train(train_no) ON DELETE CASCADE,
    CONSTRAINT fk_train_schedule_route
        FOREIGN KEY (route_id) REFERENCES route(route_id) ON DELETE RESTRICT,

    CONSTRAINT chk_train_schedule_run_day
        CHECK (run_day IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'))
);

COMMENT ON TABLE train_schedule IS 'Which route a train runs on each weekday';

CREATE INDEX idx_train_schedule_route_id ON train_schedule(route_id);

-- ---------------------------------------------------------------------
-- train_run
-- ---------------------------------------------------------------------
CREATE TABLE train_run (
    run_id SERIAL PRIMARY KEY,
    train_no VARCHAR(10) NOT NULL,
    run_date DATE NOT NULL,
    status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_train_run_train
        FOREIGN KEY (train_no) REFERENCES train(train_no) ON DELETE RESTRICT,
    CONSTRAINT uq_train_run_train_date UNIQUE (train_no, run_date)
);

COMMENT ON TABLE train_run IS 'Dated instance of a train (route derived via train_schedule)';
COMMENT ON COLUMN train_run.status IS 'Run status (domain unspecified in schema)';

CREATE INDEX idx_train_run_date ON train_run(run_date);

-- ---------------------------------------------------------------------
-- train_coach
-- ---------------------------------------------------------------------
CREATE TABLE train_coach (
    train_no VARCHAR(10) NOT NULL,
    coach_no VARCHAR(10) NOT NULL,
    class_code VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (train_no, coach_no),

    CONSTRAINT fk_train_coach_train
        FOREIGN KEY (train_no) REFERENCES train(train_no) ON DELETE CASCADE,
    CONSTRAINT fk_train_coach_class
        FOREIGN KEY (class_code) REFERENCES travel_class(class_code) ON DELETE RESTRICT
);

COMMENT ON TABLE train_coach IS 'Coaches of a train and their travel class';

CREATE INDEX idx_train_coach_class_code ON train_coach(class_code);

-- ---------------------------------------------------------------------
-- seat
-- ---------------------------------------------------------------------
CREATE TABLE seat (
    seat_id SERIAL PRIMARY KEY,
    train_no VARCHAR(10) NOT NULL,
    coach_no VARCHAR(10) NOT NULL,
    berth_no VARCHAR(10) NOT NULL,
    berth_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_seat_coach
        FOREIGN KEY (train_no, coach_no) REFERENCES train_coach(train_no, coach_no) ON DELETE CASCADE,
    CONSTRAINT uq_seat_train_coach_berth UNIQUE (train_no, coach_no, berth_no)
);

COMMENT ON TABLE seat IS 'Physical seats/berths in train coaches';
COMMENT ON COLUMN seat.berth_type IS 'LB/MB/UB/SL/SU for sleeper classes, WS/MS/AS for sitting';
