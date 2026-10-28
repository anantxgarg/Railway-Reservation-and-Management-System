# C2-Network Database Module (Team 2)

This directory houses the database for the **C2-Network** part of the railway system: stations, trains, routes, timetables, dated runs, coaches and seats. It is part of the one shared PostgreSQL database (`railway`) that every team uses; [`train-service`](../../train-service/README.md) is its API.

---

## **1. Architecture & Technology Stack**
* **Database Engine:** PostgreSQL 14+, the shared `railway` database built by [`database/setup.sh`](../setup.sh).
* **Design Paradigm:** Relational, Third Normal Form (3NF) core schema with strict foreign key referential integrity, domain constraints (`CHECK`), triggers and indexing.
* **Environment Configuration:** Connection settings come from the standard `PG*` environment variables; no credentials are stored in the repository.

The schema joins two earlier versions: Team 3's placeholder (written to match `schema_relational.dbml`, which booking was built on) and Team 2's own C2 schema. Kept from the placeholder: routes as their own table, chosen per weekday by the schedule, so a train can take different routes on different days; multi-day journeys (stops as minute offsets, plus the day they fall on); the `seat` table; text train numbers (`'12952'`). Added from Team 2: run statuses, real clock times (the route's departure time), Team 2's functions, trigger and views, and their sample trains.

---

## **2. Core Schema Entities (Table Overview)**

| Table Name | Entity Type | Description | Primary Key |
| :--- | :--- | :--- | :--- |
| `travel_class` | Master Lookup | Coach classes (`1A`, `2A`, `3A`, `SL`, `2S`, `CC`), seats per coach and fare rules | `class_code` |
| `station` | Master Lookup | Railway stations, with city, state, zone and platforms | `station_code` |
| `train` | Master Lookup | Trains, their type and active flag | `train_no` |
| `route` | Topology | A named path through stations and the time it leaves the first one | `route_id` |
| `route_station` | Topology | Ordered stops of a route: distance, minutes after departure, day reached | (`route_id`, `stop_seq`) |
| `train_schedule` | Rules | Weekdays a train runs (`Monday` .. `Sunday`) and the route it takes that day | (`train_no`, `run_day`) |
| `train_run` | Operational Instance | One train on one date: status (`SCHEDULED`, `DEPARTED`, `DELAYED`, `CANCELLED`, `ARRIVED`) and delay | `run_id` |
| `train_coach` | Rolling Stock | Coaches of a train and their class | (`train_no`, `coach_no`) |
| `seat` | Rolling Stock | Berths and seats of each coach | `seat_id` |

Columns and rules: [DATA_DICTIONARY.md](DATA_DICTIONARY.md). Diagram: [c2_network.dbml](c2_network.dbml) (paste into dbdiagram.io).

---

## **3. Script Execution Order**

The whole database is built by the shared script, which runs C1 (identity), then these files, then C3 (booking):

```bash
PGHOST=localhost PGUSER=postgres ./database/setup.sh            # creates database "railway"
PGHOST=localhost PGUSER=postgres ./database/setup.sh --reset    # drop and rebuild it
```

The files, in order:

1. **`schema.sql`** — Tables, constraints, check validations and indexes.
2. **`functions.sql`** — `route_of_run`, `stop_arrival_at` / `stop_departure_at` (timetable times of a run), `get_route_distance`, `calculate_fare`.
3. **`triggers.sql`** — `trg_validate_route_sequence`: each stop farther and later than the one before, and works out on which day a stop falls; `trg_route_departure_change` keeps that right when a route's departure time changes.
4. **`views.sql`** — `vw_train_schedules`, `vw_train_stops` (stops with clock times).
5. **`seed_dev.sql`** — Development data: 6 classes, 12 stations, 6 trains (Team 3's New Delhi – Mumbai / Chennai and Mumbai – Pune; Team 2's Pune – Mumbai / Solapur / Hubballi), runs on every scheduled day of the next 30 days, coaches and seats.

To build only these tables in an empty database: `PGDATABASE=railway_c2 ./database/c2-network/setup.sh`.

---

## **4. Times**

A route's `departure_time` is when the train leaves its first stop (Indian time). Every stop has `arrival_offset` and `departure_offset`, minutes after that, so a stop's clock time is departure time + offset, and `day_offset` (worked out by the trigger) says on which day after the run date it falls. Example, the Mumbai Rajdhani (route `NDLS-BCT`, 16:55): Vadodara is reached 610 minutes later, at 03:05 the next day (`day_offset` 1).

`train_run.status` and `delay_minutes` are set by staff through train-service. Live status adds the delay to the timetable; booking refuses runs that are `CANCELLED` or `ARRIVED`; marking a run `ARRIVED` sends passengers Team 6's "journey completed" notification.

---

## **5. Tests**

```bash
PGHOST=localhost PGUSER=postgres ./database/c2-network/tests/run_tests.sh
```

Builds `railway_c2_test` with `setup.sh`, checks the seed data, the column rules, the trigger, the functions and the views inside a rolled-back transaction, then drops it.
