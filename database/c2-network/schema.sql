-- =========================================================================
-- Railway Reservation and Management System - C2-Network Schema
-- =========================================================================

-- 1. Travel Class Master Table
CREATE TABLE "travel_class" (
	"class_code" varchar(10) PRIMARY KEY,
	"class_name" varchar(50) NOT NULL,
	"is_ac" boolean NOT NULL,
	"seats_per_coach" integer NOT NULL,
	"base_fare_per_km" numeric(8, 2) NOT NULL,
	"reservation_charge" numeric(8, 2) NOT NULL,
	CONSTRAINT "travel_class_base_fare_per_km_check" CHECK ((base_fare_per_km >= (0)::numeric)),
	CONSTRAINT "travel_class_reservation_charge_check" CHECK ((reservation_charge >= (0)::numeric)),
	CONSTRAINT "travel_class_seats_per_coach_check" CHECK ((seats_per_coach > 0))
);
CREATE UNIQUE INDEX "travel_class_pkey" ON "travel_class" ("class_code");


-- 2. Station Master Table
CREATE TABLE "station" (
	"station_code" varchar(10) CONSTRAINT "stations_station_code_key" UNIQUE,
	"station_name" varchar(150) NOT NULL,
	CONSTRAINT "stations_pkey" PRIMARY KEY("station_code")
);
CREATE UNIQUE INDEX "stations_pkey" ON "station" ("station_code");
CREATE UNIQUE INDEX "stations_station_code_key" ON "station" ("station_code");


-- 3. Train Master Table
CREATE TABLE "train" (
	"train_no" integer PRIMARY KEY,
	"train_name" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true
);
CREATE UNIQUE INDEX "train_pkey" ON "train" ("train_no");


-- 4. Route Station Table (Mapping trains to sequence of stations)
CREATE TABLE "route_station" (
	"train_no" integer,
	"stop_seq" integer,
	"station_code" varchar(10) NOT NULL,
	"distance_km" numeric(8, 2) NOT NULL,
	"arrival_time" time,
	"departure_time" time,
	CONSTRAINT "route_station_pkey" PRIMARY KEY("train_no","stop_seq"),
	CONSTRAINT "route_station_distance_km_check" CHECK ((distance_km >= (0)::numeric)),
	CONSTRAINT "route_station_stop_seq_check" CHECK ((stop_seq > 0))
);
CREATE INDEX "idx_route_station_station" ON "route_station" ("station_code");
CREATE UNIQUE INDEX "route_station_pkey" ON "route_station" ("train_no","stop_seq");

ALTER TABLE "route_station" ADD CONSTRAINT "route_station_station_code_fkey" 
    FOREIGN KEY ("station_code") REFERENCES "station"("station_code");
ALTER TABLE "route_station" ADD CONSTRAINT "route_station_train_no_fkey" 
    FOREIGN KEY ("train_no") REFERENCES "train"("train_no");


-- 5. Train Coach Table (Physical configuration of train coaches)
CREATE TABLE "train_coach" (
	"train_no" integer,
	"coach_no" varchar(10),
	"class_code" varchar(10) NOT NULL,
	CONSTRAINT "train_coach_pkey" PRIMARY KEY("train_no","coach_no")
);
CREATE UNIQUE INDEX "train_coach_pkey" ON "train_coach" ("train_no","coach_no");

ALTER TABLE "train_coach" ADD CONSTRAINT "train_coach_class_code_fkey" 
    FOREIGN KEY ("class_code") REFERENCES "travel_class"("class_code");
ALTER TABLE "train_coach" ADD CONSTRAINT "train_coach_train_no_fkey" 
    FOREIGN KEY ("train_no") REFERENCES "train"("train_no");


-- 6. Train Schedule Table (Weekly operating days per train)
CREATE TABLE "train_schedule" (
	"train_no" integer,
	"run_day" varchar(3),
	CONSTRAINT "train_schedule_pkey" PRIMARY KEY("train_no","run_day"),
	CONSTRAINT "train_schedule_run_day_check" CHECK (((run_day)::text = ANY ((ARRAY['MON'::character varying, 'TUE'::character varying, 'WED'::character varying, 'THU'::character varying, 'FRI'::character varying, 'SAT'::character varying, 'SUN'::character varying])::text[])))
);
CREATE UNIQUE INDEX "train_schedule_pkey" ON "train_schedule" ("train_no","run_day");

ALTER TABLE "train_schedule" ADD CONSTRAINT "train_schedule_train_no_fkey" 
    FOREIGN KEY ("train_no") REFERENCES "train"("train_no");


-- 7. Train Run Table (Specific operating dates and operational status)
CREATE TABLE "train_run" (
	"run_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "train_run_run_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"train_no" integer NOT NULL,
	"run_date" date NOT NULL,
	"status" varchar(12) DEFAULT 'SCHEDULED' NOT NULL,
	CONSTRAINT "train_run_train_no_run_date_key" UNIQUE("train_no","run_date"),
	CONSTRAINT "train_run_status_check" CHECK (((status)::text = ANY ((ARRAY['SCHEDULED'::character varying, 'DEPARTED'::character varying, 'DELAYED'::character varying, 'CANCELLED'::character varying, 'ARRIVED'::character varying])::text[])))
);
CREATE INDEX "idx_train_run_date" ON "train_run" ("run_date");
CREATE UNIQUE INDEX "train_run_pkey" ON "train_run" ("run_id");
CREATE UNIQUE INDEX "train_run_train_no_run_date_key" ON "train_run" ("train_no","run_date");

ALTER TABLE "train_run" ADD CONSTRAINT "train_run_train_no_fkey" 
    FOREIGN KEY ("train_no") REFERENCES "train"("train_no");