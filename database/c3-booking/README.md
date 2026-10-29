# C3 Booking, PNR & Seats — Database (Team 3)

PostgreSQL tables, seed data and tests for the booking module. Table and column names follow `schema_relational.dbml` (section C4 Booking).

> **Standalone demo branch:** Team 1's Node backend and Team 4's payments app are removed from this branch. The booking service's demo mode (`BOOKING_DEMO=true`, see [`booking-service/README.md`](../../booking-service/README.md#demo-mode-standalone-without-team-1--team-4)) stands in for them: it logs users in against C1's `users` table, calls `confirm_booking` for "payment", and calls `cancel_passengers` for paid bookings. Mentions of Team 4's code below (e.g. `ReservationRepository`) describe the integrated system.

## Files

| File | What it does | Owner |
|---|---|---|
| `00_extensions_enums.sql` | `btree_gist`; enums for train type, quota, booking and passenger status | Team 3 |
| `01_network_placeholder.sql` | `station`, `train`, `travel_class`, `route`, `route_station`, `train_schedule`, `train_run`, `train_coach`, `seat` | **Team 2** (placeholder until they start) |
| `02_quota_concession.sql` | `quota` (Team 3); `concession_rule` | `concession_rule`: **Team 4** (placeholder) |
| `03_booking.sql` | `booking`, `passenger`, `seat_allocation` | Team 3 |
| `04_functions.sql` | PNR generation, route of a run, fares, free seats, RAC capacity, availability | Team 3 (`calc_fare` is a placeholder for Team 4) |
| `05_constraints_triggers.sql` | No double booking, max 6 passengers, journey and status rules, fare totals | Team 3 |
| `06_procedures.sql` | `create_booking`, `confirm_booking`, `cancel_passengers`, `promote_queue`, `expire_holds` | Team 3 |
| `07_views.sql` | `v_pnr_status`, `v_user_bookings`, `v_run_availability`, `v_run_route` | Team 3 |
| `seed_dev.sql` | Classes, quotas, concessions, 3 trains / routes, runs for the next 30 days, coaches, 1,202 seats | Team 3 (network data is placeholder) |
| `tests/run_tests.sh`, `tests/test_db.sql` | Builds a throwaway database; 92 checks plus a 10-session race for the last berth | Team 3 |
| [`DATA_DICTIONARY.md`](DATA_DICTIONARY.md) | Every table, column, rule, view and function, with the constraint names the database reports | Team 3 |
| `c3_booking.dbml` | The schema as built, for dbdiagram.io | Team 3 |

Users are not seeded here. Booking uses C1's dev accounts (`customer@example.com`, password `Railway@Dev123`).

## How booking works

| Step | Call | Result |
|---|---|---|
| Book | `SELECT create_booking(user_id, run_id, class, quota, from_seq, to_seq, passengers_json)` | New PNR, `HELD` for 15 minutes. Each passenger gets a berth if one is free for the whole journey, else RAC, else waitlist. |
| Pay | `SELECT confirm_booking(pnr)` | `HELD` → `CONFIRMED`; returns the amount (`total_fare`, fixed from now on). Safe to call twice. Fails once the hold has expired. |
| Cancel | `SELECT * FROM cancel_passengers(pnr, ARRAY[ids])` (or `NULL` for all) | Frees berths, cancels the booking when nobody is left, promotes the queue. Returns one row per cancelled passenger for the refund. |
| Expire | `CALL expire_holds()` | Unpaid holds past expiry → `EXPIRED`, berths go to the queue. [`booking-service`](../../booking-service/README.md) runs it every minute. |
| Status | `SELECT * FROM v_pnr_status WHERE pnr = ...` | One row per passenger, `status_label` like `CNF/B1/23/LB`, `RAC 3`, `WL 12`. |

`passengers_json` is an array of 1-6 objects: `{"name": "Asha Rao", "age": 34, "gender": "F", "concession_id": null}`.

**No double booking.** Two layers: every procedure that hands out berths takes an advisory lock on the (run, class), so concurrent bookings are served one at a time; and an exclusion constraint on `seat_allocation` rejects any overlapping use of a berth on the same run, whatever code tries it. Journeys that touch at a stop don't overlap, so a berth freed at KOTA is resold from KOTA.

**Queues.** RAC and waitlist numbers are per (run, class, quota). `queue_no` is the number given when joining; `v_pnr_status.current_position` is where the passenger is now. When berths free up, RAC is served first, then the waitlist, by queue number. RAC places: 4 per 2A coach, 8 per 3A/SL coach, none in 1A or sitting classes.

**Errors** use standard SQLSTATEs so the API can map them: `P0002` not found (404), `22023` bad input (422), `23514` broken rule (422, with the rule in the constraint name), `55000` wrong state, e.g. expired hold (409), `42501` user not allowed (403).

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

Builds `railway_c3_test`, runs every check inside a rolled-back transaction, runs the race test, then drops it. Constraint tests check the SQLSTATE and the constraint name, so a test can't pass because a different rule fired.

## Notes for other teams

- **Team 1:** `booking.user_id` references `users(user_id)`. Re-running C1's `schema.sql` drops `users` with `CASCADE`, which removes this foreign key; rebuild with `setup.sh --reset` instead.
- **Team 2:** take over `01_network_placeholder.sql` and the network part of `seed_dev.sql` rather than writing new versions. The schema has no departure time for a train's first stop yet; search screens will need one.
- **Team 4:** a booking is identified by `pnr VARCHAR(10)`. `booking.total_fare` is the amount to charge while `HELD` (passengers not cancelled) and the amount paid once `CONFIRMED`. On payment success call `confirm_booking(pnr)` in the same transaction that marks the payment successful. Paid bookings are cancelled by your refund endpoint calling `cancel_passengers`, in the same transaction as the refund. Both are done in the payments app (`ReservationRepository`). `concession_rule` and `calc_fare` are placeholders for yours.
