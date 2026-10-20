# C3 Booking, PNR & Seats — Database (Team 3)

PostgreSQL tables, seed data and tests for the booking module. Table and column names follow `schema_relational.dbml` (section C4 Booking).

## Files

| File | What it does | Owner |
|---|---|---|
| `00_extensions_enums.sql` | `btree_gist`; enums for train type, quota, booking and passenger status | Team 3 |
| `01_network_placeholder.sql` | `station`, `train`, `travel_class`, `route`, `route_station`, `train_schedule`, `train_run`, `train_coach`, `seat` | **Team 2** (placeholder until they start) |
| `02_quota_concession.sql` | `quota` (Team 3); `concession_rule` | `concession_rule`: **Team 4** (placeholder) |
| `03_booking.sql` | `booking`, `passenger`, `seat_allocation` | Team 3 |
| `seed_dev.sql` | Classes, quotas, concessions, 3 trains / routes, runs for the next 30 days, coaches, 1,202 seats | Team 3 (network data is placeholder) |
| `tests/run_tests.sh`, `tests/test_db.sql` | Builds a throwaway database and checks structure, seed data and every constraint | Team 3 |

Users are not seeded here. Booking uses C1's dev accounts (`customer@example.com`, password `Railway@Dev123`).

## Setup

Use the shared script, which runs C1 first and then C3:

```bash
PGHOST=localhost PGUSER=postgres ./database/setup.sh            # creates database "railway"
PGHOST=localhost PGUSER=postgres ./database/setup.sh --reset    # drop and rebuild it
```

`--no-dev-data` skips the dev users and sample network. Set `PGDATABASE` to use another database name.

## Tests

```bash
PGHOST=localhost PGUSER=postgres ./database/c3-booking/tests/run_tests.sh
```

Builds `railway_c3_test`, runs every check inside a rolled-back transaction, then drops it. Constraint tests check the SQLSTATE and the constraint name, so a test can't pass because a different rule fired.

## Notes for other teams

- **Team 1:** `booking.user_id` references `users(user_id)`. Re-running C1's `schema.sql` drops `users` with `CASCADE`, which removes this foreign key; rebuild with `setup.sh --reset` instead.
- **Team 2:** take over `01_network_placeholder.sql` and the network part of `seed_dev.sql` rather than writing new versions. The schema has no departure time for a train's first stop yet; search screens will need one.
- **Team 4:** a booking is identified by `pnr VARCHAR(10)`. `concession_rule` is defined here only so `passenger.concession_id` has a target.
