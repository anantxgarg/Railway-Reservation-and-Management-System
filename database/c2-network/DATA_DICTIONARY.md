# C2 Network — Data Dictionary

Every table, column and rule created by the SQL files in this folder, as built by `database/setup.sh`. The diagram is [`c2_network.dbml`](c2_network.dbml) (paste it into dbdiagram.io).

- Team 2 owns everything here. Booking (Team 3, `database/c3-booking`) refers to `train_run`, `travel_class`, `seat` and the stops of `route_station`, so changes to these need a word with Team 3.
- **Rule names** (`chk_*`, `trg_*`) are what the database reports when it refuses a change; train-service returns them in `error.constraint`.
- Every `created_at` is `TIMESTAMPTZ NOT NULL DEFAULT now()` and is left out below.

## Summary of Tables

| # | Table Name | Description |
|---|------------|-------------|
| 1 | `travel_class` | Coach classes (1A, 2A, 3A, SL, 2S, CC), seats per coach and fares |
| 2 | `station` | Railway stations |
| 3 | `train` | Trains (not their dated runs) |
| 4 | `route` | Named paths through stations, with the departure time from the first stop |
| 5 | `route_station` | Ordered stops of a route: distance and minutes after departure |
| 6 | `train_schedule` | Which route a train follows on each weekday it runs |
| 7 | `train_run` | One train on one date, with its status and delay |
| 8 | `train_coach` | Coaches of a train and their class |
| 9 | `seat` | Berths and seats in each coach |

## Enums

| Enum | Values |
|---|---|
| `train_type_enum` | `Express`, `Slow`, `High-Speed` |

## Table Specifications

### `station`

| Column | Type | Null | Description |
|---|---|---|---|
| `station_code` | `VARCHAR(10)` | no | **PK.** `NDLS`, `BCT`, `MAS`, ... |
| `station_name` | `VARCHAR(200)` | no | |
| `city`, `state` | `VARCHAR(100)` | no | |
| `zone` | `VARCHAR(50)` | yes | Railway zone, e.g. Northern |
| `num_platforms` | `INTEGER` | yes | `chk_station_num_platforms`: > 0 when set |

### `train`

| Column | Type | Null | Default | Description |
|---|---|---|---|---|
| `train_no` | `VARCHAR(10)` | no | | **PK** |
| `train_name` | `VARCHAR(200)` | no | | |
| `train_type` | `train_type_enum` | no | `Express` | |
| `is_active` | `BOOLEAN` | no | `true` | |

### `travel_class`

| Column | Type | Null | Default | Description |
|---|---|---|---|---|
| `class_code` | `VARCHAR(10)` | no | | **PK.** `1A`, `2A`, `3A`, `SL`, `2S`, `CC` |
| `class_name` | `VARCHAR(100)` | no | | |
| `is_ac` | `BOOLEAN` | no | `false` | |
| `seats_per_coach` | `INTEGER` | no | | `chk_travel_class_seats`: > 0 |
| `base_fare_per_km` | `NUMERIC(10,2)` | no | | `chk_travel_class_base_fare`: > 0 |
| `reservation_charge` | `NUMERIC(10,2)` | no | `0` | Per passenger. `chk_travel_class_reservation_charge`: >= 0 |

### `route` and `route_station`

| Table | Column | Type | Null | Description |
|---|---|---|---|---|
| `route` | `route_id` | `SERIAL` | no | **PK** |
| | `route_code` | `VARCHAR(20)` | no | Unique, e.g. `NDLS-BCT` |
| | `route_name` | `VARCHAR(200)` | no | |
| | `departure_time` | `TIME` | no | When the train leaves the first stop, Indian time. The stop offsets count from it |
| `route_station` | `route_id` | `INTEGER` | no | **PK** part. **FK** `route`, `ON DELETE CASCADE` |
| | `stop_seq` | `INTEGER` | no | **PK** part. 1, 2, 3, ... (`chk_route_station_stop_seq`: > 0). `booking.from_seq`/`to_seq` refer to it |
| | `station_code` | `VARCHAR(10)` | no | **FK** `station`. Index `idx_route_station_station_code` |
| | `distance_km` | `NUMERIC(10,2)` | no | From the origin, >= 0 |
| | `arrival_offset` | `INTEGER` | yes | Minutes after leaving the origin; `NULL` at the origin |
| | `departure_offset` | `INTEGER` | no | Minutes after leaving the origin, >= 0 |
| | `day_offset` | `INTEGER` | no | Day the stop is reached, counted from the run date. **Worked out by `trg_validate_route_sequence`** from `departure_time` and the offsets; a typed value is replaced |
| | `default_platform` | `VARCHAR(10)` | yes | |

Clock time at a stop = `route.departure_time` + offset (view `vw_train_stops`, functions `stop_arrival_at` / `stop_departure_at`).

### `train_schedule`, `train_run`

| Table | Column | Type | Null | Description |
|---|---|---|---|---|
| `train_schedule` | `train_no` | `VARCHAR(10)` | no | **PK** part. **FK** `train`, `ON DELETE CASCADE` |
| | `run_day` | `VARCHAR(10)` | no | **PK** part. `Monday` .. `Sunday` (`chk_train_schedule_run_day`) |
| | `route_id` | `INTEGER` | no | **FK** `route`. Index `idx_train_schedule_route_id` |
| `train_run` | `run_id` | `SERIAL` | no | **PK** |
| | `train_no` | `VARCHAR(10)` | no | **FK** `train` |
| | `run_date` | `DATE` | no | Date the train leaves its origin. Unique with `train_no` (`uq_train_run_train_date`); index `idx_train_run_date` |
| | `status` | `VARCHAR(12)` | no | `SCHEDULED` (default), `DEPARTED`, `DELAYED`, `CANCELLED`, `ARRIVED` (`chk_train_run_status`). Set by staff through train-service. Booking refuses `CANCELLED` and `ARRIVED` runs |
| | `delay_minutes` | `INTEGER` | no | Minutes behind the timetable (default 0, `chk_train_run_delay`: >= 0). Shown by live status |

A run's route is the schedule's route for the weekday of `run_date` (view `v_run_route`).

### `train_coach`, `seat`

| Table | Column | Type | Null | Description |
|---|---|---|---|---|
| `train_coach` | `train_no` | `VARCHAR(10)` | no | **PK** part. **FK** `train`, `ON DELETE CASCADE` |
| | `coach_no` | `VARCHAR(10)` | no | **PK** part. `B1`, `S3`, ... |
| | `class_code` | `VARCHAR(10)` | no | **FK** `travel_class`. Index `idx_train_coach_class_code` |
| `seat` | `seat_id` | `SERIAL` | no | **PK** |
| | `train_no`, `coach_no` | `VARCHAR(10)` | no | **FK** `train_coach` (`fk_seat_coach`, `ON DELETE CASCADE`) |
| | `berth_no` | `VARCHAR(10)` | no | Unique within the coach (`uq_seat_train_coach_berth`) |
| | `berth_type` | `VARCHAR(50)` | yes | `LB`/`MB`/`UB`/`SL`/`SU` for sleeper classes, `WS`/`MS`/`AS` for sitting |

## Triggers (`triggers.sql`)

| Trigger | On | Rule | Reported as |
|---|---|---|---|
| `trg_validate_route_sequence` | `route_station` insert/update | A stop is farther than the previous one and not reached before the previous one is left; a train doesn't leave a stop before arriving. Sets `day_offset` | `23514`, `trg_validate_route_sequence` |
| `trg_route_departure_change` | `route.departure_time` update | Works `day_offset` out again for the route's stops | |

## Functions (`functions.sql`)

| Name | Returns | Purpose |
|---|---|---|
| `route_of_run(run_id)` | `INTEGER` | Route a run follows: the schedule's route for the weekday of `run_date` |
| `stop_arrival_at(run_id, stop_seq)`, `stop_departure_at(run_id, stop_seq)` | `TIMESTAMPTZ` | When the run reaches / leaves a stop by the timetable (arrival is `NULL` at the first stop) |
| `get_route_distance(train_no, from_station, to_station)` | `NUMERIC` | Km between two stations on the train's route; 0 if not served in that order |
| `calculate_fare(train_no, from_station, to_station, class_code)` | `NUMERIC` | Base fare: distance × class rate + reservation charge; 0 if unknown. Booking charges with C3's `calc_fare`, which adds quota and concession |
| `stop_day_offset(departure_time, offset_minutes)` | `INTEGER` | Day a stop is reached; used by the trigger |

## Views (`views.sql`)

| View | One row per | Columns |
|---|---|---|
| `vw_train_schedules` | train and weekday | `train_no`, `train_name`, `is_active`, `run_day`, `route_id`, `route_code`, `departure_time` |
| `vw_train_stops` | train and stop | `train_no`, `train_name`, `route_id`, `stop_seq`, `station_code`, `station_name`, `distance_km`, `arrival_time`, `departure_time` (clock times), `day_offset` |
