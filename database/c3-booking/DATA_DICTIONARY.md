# C3 Booking, PNR & Seats — Data Dictionary

Every table, column and rule created by the SQL files in this folder, as built by `database/setup.sh`. The diagram is [`c3_booking.dbml`](c3_booking.dbml) (paste it into dbdiagram.io).

- **Owner** says which team is responsible. Team 3 owns `quota`, `booking`, `passenger`, `seat_allocation` and `notification_outbox`. `concession_rule` is a placeholder for Team 4. The network tables are Team 2's ([C2 data dictionary](../c2-network/DATA_DICTIONARY.md)).
- **Rule names** (`chk_*`, `trg_*`, `excl_*`) are what the database reports when it refuses a change, and the booking API returns them in `error.constraint`. For triggers, see the "Reported as" column under [Cross-row rules](#cross-row-rules).
- All timestamps are `TIMESTAMPTZ`. All money is `NUMERIC(10,2)` in rupees.

## Contents

- [Enums](#enums)
- [Booking tables (Team 3)](#booking-tables-team-3): `quota`, `booking`, `passenger`, `seat_allocation`
- [Cross-row rules](#cross-row-rules)
- [Concessions (placeholder, Team 4)](#concessions-placeholder-team-4): `concession_rule`
- [Network (Team 2)](#network-team-2): moved to `database/c2-network`
- [Notifications for Team 6](#notifications-for-team-6): `notification_outbox`
- [Views](#views)
- [Functions and procedures](#functions-and-procedures)
- [Tables of other teams that reference bookings](#tables-of-other-teams-that-reference-bookings)

## Enums

| Enum | Values | Meaning |
|---|---|---|
| `booking_status_enum` | `HELD`, `CONFIRMED`, `CANCELLED`, `EXPIRED` | `HELD`: created, waiting for payment, berths held until `hold_expires_at`. `CONFIRMED`: paid. `CANCELLED`: every passenger cancelled. `EXPIRED`: hold lapsed unpaid. |
| `passenger_status_enum` | `CONFIRMED`, `RAC`, `WAITLIST`, `CANCELLED` | `CONFIRMED`: has a berth (`seat_allocation` row). `RAC`: shares a side-lower berth, no row. `WAITLIST`: queued, no berth. `CANCELLED`: removed from the booking. |
| `quota_name_enum` | `General`, `Tatkal`, `Ladies`, `Senior` | Names for `quota.quota_name`. |

**Status changes allowed:**
- Booking: `HELD` → `CONFIRMED` | `CANCELLED` | `EXPIRED`, and `CONFIRMED` → `CANCELLED`.
- Passenger: `WAITLIST` → `RAC` | `CONFIRMED` | `CANCELLED`, `RAC` → `CONFIRMED` | `CANCELLED`, and `CONFIRMED` → `CANCELLED`.

Anything else is refused (`trg_booking_status_flow`, `trg_passenger_status_flow`).

## Booking tables (Team 3)

### `quota`

Booking allocation categories. File `02_quota_concession.sql`.

| Column | Type | Null | Default | Description |
|---|---|---|---|---|
| `quota_code` | `VARCHAR(10)` | no | | **PK.** `GN`, `TK`, `LD`, `SR` |
| `quota_name` | `quota_name_enum` | no | | Unique |
| `fare_multiplier` | `NUMERIC(5,2)` | no | `1.00` | Applied to the base fare, e.g. `1.30` for Tatkal. `chk_quota_fare_multiplier`: > 0 |
| `description` | `TEXT` | yes | | |
| `created_at` | `TIMESTAMPTZ` | no | now | |

### `booking`

One reservation, identified by its PNR. File `03_booking.sql`.

| Column | Type | Null | Default | Description |
|---|---|---|---|---|
| `pnr` | `VARCHAR(10)` | no | | **PK.** 10 digits: a 9-digit sequence number (`pnr_seq`) plus a Luhn check digit, from `generate_pnr()` |
| `user_id` | `INTEGER` | no | | **FK** `users` (Team 1), the customer who booked |
| `run_id` | `INTEGER` | no | | **FK** `train_run`: the train on a date |
| `class_code` | `VARCHAR(10)` | no | | **FK** `travel_class` |
| `quota_code` | `VARCHAR(10)` | no | | **FK** `quota` |
| `from_seq` | `INTEGER` | no | | Boarding stop: `route_station.stop_seq` on the run's route |
| `to_seq` | `INTEGER` | no | | Alighting stop. `chk_booking_segment`: `from_seq < to_seq` |
| `total_fare` | `NUMERIC(10,2)` | no | | While `HELD`: the fares of passengers not cancelled, kept up to date by `trg_passenger_sync_total`. From `CONFIRMED` on: the amount paid, fixed. `chk_booking_total_fare`: >= 0 |
| `status` | `booking_status_enum` | no | `HELD` | |
| `hold_expires_at` | `TIMESTAMPTZ` | yes | | When an unpaid booking expires (15 minutes after booking). `chk_booking_hold_expiry`: set exactly when `HELD` |
| `created_at` | `TIMESTAMPTZ` | no | now | |

All foreign keys are `ON DELETE RESTRICT`.

Indexes:
- `idx_booking_user` (`user_id`)
- `idx_booking_run_class_quota` (`run_id, class_code, quota_code`)
- `idx_booking_status` (`status`)
- `idx_booking_hold_expires` (`hold_expires_at`, only rows with status `HELD`)

### `passenger`

A traveller on a PNR, at most 6 per PNR. File `03_booking.sql`.

| Column | Type | Null | Default | Description |
|---|---|---|---|---|
| `passenger_id` | `SERIAL` | no | | **PK** |
| `pnr` | `VARCHAR(10)` | no | | **FK** `booking`, `ON DELETE CASCADE` |
| `concession_id` | `INTEGER` | yes | | **FK** `concession_rule`, `ON DELETE SET NULL` |
| `name` | `VARCHAR(100)` | no | | `chk_passenger_name`: not blank |
| `age` | `INTEGER` | no | | `chk_passenger_age`: 1 to 120 |
| `gender` | `CHAR(1)` | no | | `chk_passenger_gender`: `M`, `F` or `O` |
| `status` | `passenger_status_enum` | no | | |
| `queue_no` | `INTEGER` | yes | | Number given on joining the RAC or waitlist queue of (run, class, quota). It never changes; the current position is in `v_pnr_status`. `chk_passenger_queue_no`: set (> 0) exactly when `RAC` or `WAITLIST` |
| `passenger_fare` | `NUMERIC(10,2)` | no | | Fare after quota and concession (`calc_fare`). `chk_passenger_fare`: >= 0 |
| `cancelled_at` | `TIMESTAMPTZ` | yes | | `chk_passenger_cancelled_at`: set exactly when `CANCELLED` |

Indexes:
- `idx_passenger_pnr` (`pnr`)
- `idx_passenger_queue` (`status, queue_no`, only `RAC` and `WAITLIST` rows)

The passenger number shown on tickets (1, 2, ...) is not stored. `v_pnr_status` numbers passengers by `passenger_id` within the PNR.

### `seat_allocation`

The berth of a `CONFIRMED` passenger for their part of the journey. File `03_booking.sql`.

| Column | Type | Null | Default | Description |
|---|---|---|---|---|
| `allocation_id` | `SERIAL` | no | | **PK** |
| `passenger_id` | `INTEGER` | no | | **FK** `passenger`, `ON DELETE CASCADE`. Unique: one berth per passenger |
| `seat_id` | `INTEGER` | no | | **FK** `seat` |
| `run_id` | `INTEGER` | no | | **FK** `train_run`. A deliberate copy of `booking.run_id`, needed by the no-overlap constraint |
| `from_seq` | `INTEGER` | no | | Copy of `booking.from_seq` |
| `to_seq` | `INTEGER` | no | | Copy of `booking.to_seq`. `chk_seat_allocation_segment`: `from_seq < to_seq` |

**No double booking:**

```sql
excl_seat_allocation_no_overlap
  EXCLUDE USING gist (seat_id WITH =, run_id WITH =, int4range(from_seq, to_seq) WITH &&)
```

- **What it blocks:** the same berth on the same run, on journeys that overlap.
- **What it allows:** journeys that only touch at a stop, such as `[1,3)` and `[3,4)`. A berth freed at stop 3 can be sold onwards from stop 3.
- **Why it can't be bypassed:** it holds whatever code writes the row.

Index: `idx_seat_allocation_run` (`run_id`).

## Cross-row rules

Defined in `05_constraints_triggers.sql`. A refusal raises SQLSTATE `23514` and reports the name in the last column as the constraint.

| Trigger | On | What it enforces | Reported as |
|---|---|---|---|
| `trg_booking_validate` | `booking` insert | The run has a schedule for its weekday and both stops are on its route | `trg_booking_valid_stops` |
| | | The train has a coach of the class | `trg_booking_class_on_train` |
| `trg_booking_guard_update` | `booking` update | PNR, user, run, class, quota, stops and `created_at` never change | `trg_booking_immutable` |
| | | Status only moves as listed under Enums | `trg_booking_status_flow` |
| `trg_passenger_before_insert` | `passenger` insert | Passengers are added only while the booking is `HELD` | `trg_passenger_booking_held` |
| | | At most 6 per PNR (locks the booking row so two inserts can't both pass) | `trg_passenger_max_six` |
| `trg_passenger_guard_update` | `passenger` update | A passenger can't move to another PNR | `trg_passenger_immutable` |
| | | Status only moves forward | `trg_passenger_status_flow` |
| `trg_passenger_sync_total` | `passenger` insert, delete, update of fare or status | While the booking is `HELD`, `total_fare` = sum of fares of passengers not cancelled. Once `CONFIRMED` it is left alone | (never refuses) |
| `trg_seat_allocation_validate` | `seat_allocation` insert, update | Same run and stops as the booking; the seat is on that train and in the booked class | `trg_seat_allocation_matches_booking` |
| | | Only `CONFIRMED` passengers get a berth | `trg_seat_allocation_confirmed_only` |
| `chk_confirmed_has_seat` | `passenger`, `seat_allocation` (deferred to COMMIT) | A passenger is `CONFIRMED` exactly when they have a `seat_allocation` row | `chk_confirmed_has_seat` |

Besides these, every procedure that hands out berths takes an advisory lock on (run, class). Concurrent bookings of one class are therefore served one at a time; `tests/` races 10 sessions for the last berth.

## Concessions (placeholder, Team 4)

### `concession_rule`

Discounts per passenger, applied by `calc_fare` at booking. File `02_quota_concession.sql`.

| Column | Type | Null | Default | Description |
|---|---|---|---|---|
| `concession_id` | `SERIAL` | no | | **PK** |
| `concession_name` | `VARCHAR(100)` | no | | Unique |
| `eligibility_rule` | `TEXT` | no | | Free text |
| `discount_type` | `VARCHAR(50)` | no | | `PERCENTAGE` or `FIXED_AMOUNT` (`chk_concession_discount_type`) |
| `discount_value` | `NUMERIC(10,2)` | no | | Percent 0-100, or rupees. `chk_concession_discount_value`: >= 0 |
| `description` | `TEXT` | yes | | |
| `is_active` | `BOOLEAN` | no | `true` | Inactive rules can't be used for new bookings |
| `created_at` | `TIMESTAMPTZ` | no | now | |

Team 4's payments app keeps its own concession percentages and staff-verified applications (`concession_applications`). The two need to become one; see the root README.

## Network (Team 2)

The network tables (`station`, `train`, `travel_class`, `route`, `route_station`, `train_schedule`, `train_run`, `train_coach`, `seat`) started here as a placeholder and are now Team 2's: see [`database/c2-network/DATA_DICTIONARY.md`](../c2-network/DATA_DICTIONARY.md). Booking uses `route_of_run()` and `stop_departure_at()` from there.

## Notifications for Team 6

File `08_notifications.sql`. A transactional outbox: rows are written in the same transaction as the change they describe, and booking-service delivers them to Team 6's notification-service (`POST /api/notifications`), retrying while it is down.

### `notification_outbox`

| Column | Type | Null | Default | Description |
|---|---|---|---|---|
| `event_id` | `BIGSERIAL` | no | | **PK**. Delivery order |
| `type` | `VARCHAR(30)` | no | | One of Team 6's types (`chk_outbox_type`): `BOOKING_CONFIRMED`, `BOOKING_CANCELLED`, `PAYMENT_CONFIRMED`, `JOURNEY_REMINDER`, `WL_TO_RAC`, `RAC_TO_CNF`, `JOURNEY_COMPLETED` |
| `user_id` | `INTEGER` | no | | Owner of the booking (C1 `users.user_id`) |
| `pnr` | `VARCHAR(10)` | no | | **FK** `booking`, `ON DELETE CASCADE` |
| `source_team` | `VARCHAR(30)` | no | | `team-2`, `team-3` or `team-4` |
| `data` | `JSONB` | no | | The `data` object Team 6 expects for the type |
| `event_time` | `TIMESTAMPTZ` | no | `clock_timestamp()` | |
| `attempts`, `last_error` | `INTEGER`, `TEXT` | no, yes | `0` | Failed deliveries so far |
| `sent_at` | `TIMESTAMPTZ` | yes | | When Team 6 accepted it |

Indexes: `idx_outbox_unsent` (partial, unsent rows); `uq_outbox_once_per_booking` on (`pnr`, `type`) for `JOURNEY_REMINDER` and `JOURNEY_COMPLETED`, so each is sent once per booking.

| Event | Written by |
|---|---|
| `BOOKING_CONFIRMED` | trigger `trg_notify_booking_confirmed`, when a booking goes `HELD` → `CONFIRMED` (paid) |
| `WL_TO_RAC`, `RAC_TO_CNF` | constraint trigger `trg_notify_passenger_promoted` (at `COMMIT`), when a passenger of an existing booking moves up the queue |
| `BOOKING_CANCELLED` | booking-service (unpaid bookings) and payments (with the refund), via `queue_notification()` |
| `PAYMENT_CONFIRMED` | payments, via `queue_notification()` |
| `JOURNEY_REMINDER` | booking-service's job, via `queue_journey_reminders(interval)` |
| `JOURNEY_COMPLETED` | train-service when staff mark a run `ARRIVED`, via `queue_journey_completed(run_id)` |

## Views

File `07_views.sql`.

| View | One row per | Columns of note |
|---|---|---|
| `v_run_route` | train run | `run_id`, `train_no`, `train_name`, `run_date`, `route_id` (from `train_schedule` by weekday) |
| `v_pnr_status` | passenger | Booking and journey (`journey_date` = run date + day offset of the boarding stop, station names), `passenger_no` (1, 2, ... within the PNR), `passenger_status`, `queue_no`, `current_position` (place now in the RAC or waitlist queue, `NULL` otherwise), `coach_no`, `berth_no`, `berth_type`, `status_label` (`CNF/B1/23/LB`, `RAC 3`, `WL 12`, `CAN`) |
| `v_user_bookings` | booking | `pnr`, `user_id`, `status`, train, `journey_date`, `from_station`, `to_station`, class, quota, `passengers`, `active_passengers`, `total_fare`, `hold_expires_at`, `created_at` |
| `v_run_availability` | (run, class) | `total_seats`, `available_seats`, `rac_capacity`, `rac_available`, `waitlist_count` for the whole route. For part of the route call `availability()` |

## Functions and procedures

Files `04_functions.sql` and `06_procedures.sql`; how to call them is in the [README](README.md#how-booking-works).

| Name | Kind | Purpose |
|---|---|---|
| `generate_pnr()`, `is_valid_pnr(text)` | function | Next PNR from `pnr_seq` with a Luhn check digit; validate one |
| `calc_fare(run, class, quota, from, to, concession)` | function | distance × class rate × quota multiplier, minus concession, plus reservation charge. Placeholder for Team 4 |
| `free_seats(...)`, `rac_capacity(run, class)`, `availability(run, class, from, to)` | function | Berths free for a whole journey; RAC places (4 per 2A coach, 8 per 3A/SL coach); availability per class |
| `create_booking(user, run, class, quota, from, to, passengers_json)` | function | Books 1 to 6 passengers: berth, else RAC, else waitlist. Returns the PNR, `HELD` for 15 minutes |
| `confirm_booking(pnr)` | function | `HELD` → `CONFIRMED`, returns the amount. Safe to call twice; fails after the hold expires |
| `cancel_passengers(pnr, ids)` | function | Cancels the listed passengers (or all), frees berths, promotes the queue; returns each cancelled passenger's fare |
| `promote_queue(run, class)` | procedure | Gives freed berths to RAC first, then the waitlist, by queue number |
| `expire_holds()` | procedure | Unpaid holds past expiry → `EXPIRED`; the booking service runs it every minute |
| `queue_notification(type, pnr, source_team, data)` | function | Adds one event for Team 6 for the PNR's owner (file `08_notifications.sql`) |
| `queue_journey_reminders(within)`, `queue_journey_completed(run)` | function | Queue `JOURNEY_REMINDER` / `JOURNEY_COMPLETED` for paid bookings, once each; return how many |

## Tables of other teams that reference bookings

These are Team 4's tables, created by Flyway (`src/main/resources/db/migration`, `V2__link_to_c3_booking.sql`), not by the files here. They are listed because they point at C3 rows.

| Table | Column | References | Note |
|---|---|---|---|
| `payments` | `pnr` | `booking(pnr)` | One Razorpay order and payment per row. Status `CREATED`, `PAID`, `PARTIALLY_REFUNDED`, `REFUNDED` |
| `refunds` | `pnr`, `payment_id` | `booking(pnr)`, `payments(id)` | One cancellation of one or more passengers, with the amount refunded |
| `concession_applications` | `pnr`, `passenger_id` | `booking(pnr)`, `passenger(passenger_id)` | Concession claim for one passenger, verified by staff |

Their user columns reference `users(user_id)` (Team 1).
