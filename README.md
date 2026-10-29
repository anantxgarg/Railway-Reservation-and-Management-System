# Railway Reservation System: Team 3 demo (Booking, PNR & Seats)

This branch (`team3`) runs **Team 3's part of the Railway Reservation System on its own**: the booking database, the booking API and the booking screens. You need PostgreSQL, Java and Node.js, and nothing from the other teams.

```bash
./start-demo.sh          # then open http://localhost:5173 and log in as customer@example.com / Railway@Dev123
```

Step-by-step instructions, from setup to shutdown: **[run.md](run.md)**.

It was cut from `team3` at commit `886af82`. The full system, with every team's services, lives on `main`.

---

## Contents

1. [What Team 3 built](#1-what-team-3-built)
2. [What demo mode stands in for](#2-what-demo-mode-stands-in-for)
3. [Prerequisites](#3-prerequisites)
4. [Quick start](#4-quick-start)
5. [Starting it by hand](#5-starting-it-by-hand)
6. [Demo accounts](#6-demo-accounts)
7. [A 5-minute demo](#7-a-5-minute-demo)
8. [Tests](#8-tests)
9. [What was removed from this branch](#9-what-was-removed-from-this-branch)

---

## 1. What Team 3 built

| Part | Folder | What it is |
|---|---|---|
| Database (C3) | [`database/c3-booking/`](database/c3-booking/README.md) | PostgreSQL tables, functions, triggers, procedures and views. **All booking rules live here.** |
| Booking API | [`booking-service/`](booking-service/README.md) | Spring Boot 3.3 / Java 17 on port **8082**. Checks who is calling, calls the C3 functions through `JdbcTemplate`, and turns database errors into HTTP errors. |
| Booking screens | `frontend/src/features/booking/` | React + Material UI (Vite) on port **5173**: search, passenger form, PNR page, PNR lookup, my bookings. |

### Database: `database/c3-booking/`

Every column, rule and constraint name is in [`DATA_DICTIONARY.md`](database/c3-booking/DATA_DICTIONARY.md). The schema as built is in `c3_booking.dbml`, which you can paste into dbdiagram.io.

**Tables**
- `booking`: one row per PNR. Its status is `HELD`, `CONFIRMED`, `CANCELLED` or `EXPIRED`.
- `passenger`: 1 to 6 per PNR. Each passenger is `CONFIRMED`, `RAC`, `WAITLIST` or `CANCELLED`, and has a queue number and a fare.
- `seat_allocation`: which berth a confirmed passenger holds, on which run, between which stops.
- `quota`: `GN` General, `TK` Tatkal (×1.3), `LD` Ladies, `SR` Senior.

Team 2's network tables (`station`, `train`, `route`, `train_run`, `train_coach`, `seat`, ...) and Team 4's `concession_rule` are placeholders written by Team 3, so the booking tables have something to point at.

**Functions** (`04_functions.sql`)
- `generate_pnr()`: a 10-digit PNR, 9 digits from a sequence plus a Luhn check digit. `is_valid_pnr()` checks one.
- `calc_fare(...)`: distance × class rate × quota multiplier, minus any concession, plus the reservation charge. This is a placeholder for Team 4.
- `free_seats(...)`: berths that are free for the whole journey.
- `rac_capacity(run, class)`: 4 RAC places per 2A coach, 8 per 3A or SL coach, none in 1A or the sitting classes.
- `availability(run, class, from, to)`: availability per class for one journey.

**Triggers and constraints** (`05_constraints_triggers.sql`)
- **No double booking:** an exclusion constraint on `seat_allocation` (`btree_gist`) refuses any overlapping use of a berth on the same run, whatever code tries it. Journeys that only touch at a stop don't overlap, so a berth freed at KOTA is sold again from KOTA.
- **At most 6 passengers per PNR.** This check locks the booking row, so two inserts at once can't both get through.
- **Status flow:**
  - Booking: `HELD` → `CONFIRMED` / `CANCELLED` / `EXPIRED`, and `CONFIRMED` → `CANCELLED`.
  - Passenger: `WAITLIST` → `RAC` / `CONFIRMED`, and `RAC` → `CONFIRMED`. Any of them can become `CANCELLED`.
  - Nothing else is allowed.
- **Valid journeys:**
  - The run has a schedule for its weekday.
  - Both stops are on its route.
  - The train has a coach of the booked class.
  - An allocated berth belongs to that train and class.
- **Immutable fields:** a PNR's user, run, class, quota and stops never change.
- **Fare total:** while a booking is `HELD`, `total_fare` is kept equal to the sum of the fares of passengers who aren't cancelled.
- **Berths match status:** a deferred check makes sure a passenger is `CONFIRMED` exactly when they hold a berth.

**Procedures** (`06_procedures.sql`)

| Call | What it does |
|---|---|
| `create_booking(user, run, class, quota, from, to, passengers_json)` | Gives each passenger a berth if one is free for the whole journey, else an RAC place, else a waitlist place. Returns a PNR that is `HELD` for **15 minutes**. |
| `confirm_booking(pnr)` | `HELD` → `CONFIRMED`, and returns the amount to charge. Calling it twice is safe; it fails once the hold has expired. This is what payment calls. |
| `cancel_passengers(pnr, ids)` | Cancels some passengers, or everyone when `ids` is `NULL`. Frees their berths, cancels the booking once nobody is left, and promotes the queue. Returns each cancelled passenger's fare, for the refund. |
| `promote_queue(run, class)` | Hands freed berths to **RAC first, then the waitlist**, in queue order. Waitlisted passengers can also move into freed RAC places. |
| `expire_holds()` | Unpaid holds past their expiry become `EXPIRED`, and their berths go to the queue. booking-service runs it **every minute**. |

**Views** (`07_views.sql`)
- `v_pnr_status`: one row per passenger, with a ticket-style label: `CNF/B1/23/LB`, `RAC 3`, `WL 12` or `CAN`. It also gives each queued passenger's current position.
- `v_user_bookings`, `v_run_availability`, `v_run_route`.

**Race-safe seat allocation.** Every procedure that hands out berths first takes an advisory lock on the (run, class), so concurrent bookings for one class are served one at a time. The exclusion constraint is the second line of defence. The test suite starts 10 sessions at once for the last free berth: exactly one gets it, the other nine get WL 1 to 9, and no berth is sold twice.

**Errors** use standard SQLSTATEs, which booking-service maps to HTTP status codes:

| SQLSTATE | Meaning | HTTP |
|---|---|---|
| `P0002` | not found | 404 |
| `22023` | bad input | 422 |
| `23514` | a rule was broken (the constraint name says which) | 422 |
| `55000` | wrong state, e.g. the hold expired | 409 |
| `42501` | user not allowed | 403 |

### Booking API: `booking-service/` (port 8082)

| Method | Path | Who | What |
|---|---|---|---|
| GET | `/api/search?from=NDLS&to=MAS&date=YYYY-MM-DD` | anyone | Trains that stop at `from` and later at `to` on that date, with availability and fare per class |
| GET | `/api/runs/{runId}/availability?class=3A&from=NDLS&to=NGP` | anyone | Berths, RAC and waitlist per class for one journey |
| POST | `/api/bookings` | CUSTOMER | Book 1 to 6 passengers and hold them for 15 minutes. Returns `201` with the booking |
| GET | `/api/bookings/mine` | logged in | The caller's bookings, newest first |
| GET | `/api/bookings/{pnr}` | owner, STAFF, ADMIN | PNR status with every passenger |
| POST | `/api/bookings/{pnr}/cancel` | owner, STAFF, ADMIN | Cancel some passengers (`{"passengerIds": [..]}`), or everyone when there is no body |

Two more rules:
- A customer who asks for someone else's PNR gets `404`, not `403`, so nobody can probe which PNRs exist.
- Errors look like `{"error": {"code", "message", "constraint"}}`.

Request and response examples are in [`booking-service/README.md`](booking-service/README.md).

### Screens: `frontend/` (port 5173)

| Route | Screen |
|---|---|
| (not logged in) | Log in |
| `#/search` | Search trains by station codes and date, with availability and fare per class |
| `#/book/{runId}/{class}/{from}/{to}` | Passenger form, 1 to 6 passengers; submitting holds the seats |
| `#/pnr/{pnr}` | The booking: 15-minute hold countdown, pay, status of each passenger (`CNF/B1/1/LB`, `RAC 2`, `WL 1`), cancel passengers |
| `#/pnr` | PNR lookup |
| `#/bookings` | My bookings |

The Vite dev server forwards `/api/...` to booking-service, so the browser only ever talks to http://localhost:5173.

---

## 2. What demo mode stands in for

In the full system, two other teams' services sit around booking:
- **Team 1** (`backend/`: Node.js, PostgreSQL and MongoDB) logs users in and issues the JWTs that booking-service checks.
- **Team 4** (Spring Boot and Razorpay) takes the payment and then calls `confirm_booking(pnr)`.

Running both just to show booking would need MongoDB and Razorpay keys. Instead, booking-service has a **demo mode**, turned on with `BOOKING_DEMO=true` (`start-demo.sh` turns it on for you). It adds two stand-ins:

| Stand-in | Replaces | How it works |
|---|---|---|
| `POST /api/auth/login`, `/refresh`, `/logout`, `GET /api/auth/me` | Team 1's login backend | Same endpoints and JSON as Team 1. It checks the password against the bcrypt hash in C1's `users` table, and only `ACTIVE` accounts get in. Tokens are made the way Team 1 makes them: HS256, signed with `JWT_SECRET`, 15 minutes. So booking-service verifies them exactly as it verifies Team 1's tokens. |
| `POST /api/bookings/{pnr}/demo-pay` | Team 4's Razorpay payment | Calls `confirm_booking(pnr)` straight away (what Team 4 calls after a successful payment). No money changes hands. |

A few things the stand-ins don't do:
- The login stand-in doesn't count failed attempts or lock accounts, and writes no audit log.
- Refresh tokens are kept in memory, so restarting the service logs everybody out.
- In demo mode a paid (`CONFIRMED`) booking is also cancelled with `POST /api/bookings/{pnr}/cancel`, and no refund is made. In the full system that goes through Team 4's refunds.
- Registration and password reset are Team 1's and aren't part of the demo.

Demo mode is **off by default**. With it off, booking-service behaves exactly as it does in the integrated system. Never turn it on next to the real Team 1 and Team 4 services.

---

## 3. Prerequisites

| Tool | Version | Check with |
|---|---|---|
| PostgreSQL server | 14 or newer, running | |
| PostgreSQL client (`psql`, `createdb`, `dropdb`) | 14 or newer, on the `PATH` | `psql --version` |
| Java (JDK) | 17 or newer | `java -version` |
| Node.js and npm | 18 or newer (20 recommended) | `node -v` |
| curl, bash | any | Git Bash on Windows has both |

You don't need Maven: `booking-service/` has its own wrapper (`./mvnw`, or `mvnw.cmd` on Windows), and the first run downloads Maven 3.8.7.

On **Windows**, install Git for Windows, Node.js LTS, Temurin JDK 17 and PostgreSQL (tick "Command Line Tools", and add its `bin` folder to `PATH`). Run everything in **Git Bash**.

No PostgreSQL yet? With Docker:

```bash
docker run -d --name railway-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
```

### `.env` (optional)

`start-demo.sh` reads a `.env` file in the repo root. Git ignores it, so it is never committed. Anything you leave out gets the default shown here:

```bash
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres          # your PostgreSQL password
PGDATABASE=railway
# Signs login tokens. Leave it out and start-demo.sh makes a random one per run
# (you're then logged out after each restart). To keep one:
#   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=
# BOOKING_PORT=8082
```

---

## 4. Quick start

```bash
./start-demo.sh            # first run builds the "railway" database, later runs reuse it
./start-demo.sh --reset    # drop and rebuild the database first (fresh seats and dates)
```

The script:
1. Loads `.env`, checks that `psql`, `createdb`, `java`, `node`, `npm` and `curl` are installed, and checks it can reach PostgreSQL.
2. Builds the database with `database/setup.sh` if the `booking` table doesn't exist yet, or always with `--reset`.
3. Starts booking-service with `BOOKING_DEMO=true` and waits until port 8082 answers. The first start downloads Maven and the dependencies, which can take a few minutes.
4. Runs `npm install` in `frontend/` if needed, starts the dev server, and prints the URL and the logins.
5. **Ctrl+C stops both.** On Windows it kills the whole `java.exe` / `node.exe` process trees.

Logs are in `logs/booking-service.log` and `logs/frontend.log`.

The sample trains have runs for the 30 days after the database was built. If the script warns that they have run out, use `--reset`.

---

## 5. Starting it by hand

Three terminals, all opened in the repo root (Git Bash on Windows):

```bash
# 1. database (once; add --reset to rebuild)
set -a; source .env; set +a          # or export PGHOST/PGUSER/PGPASSWORD yourself
./database/setup.sh

# 2. booking-service, demo mode
set -a; source .env; set +a          # JWT_SECRET must be set here
cd booking-service
BOOKING_DEMO=true ./mvnw spring-boot:run

# 3. frontend
cd frontend
npm install
npm run dev                          # http://localhost:5173
```

`database/setup.sh` builds the C1 identity tables and dev users (Team 1's SQL, because `booking.user_id` references `users`), then the C3 booking tables and seed data. If the database is already built it stops with exit code 1; use `--reset` to rebuild it.

In Windows `cmd.exe`, set each variable with `set NAME=value` and use `mvnw.cmd spring-boot:run`.

---

## 6. Demo accounts

From `database/c1-identity/seed_dev_users.sql`. The password for every account is **`Railway@Dev123`**.

| E-mail | Role | Status | In the demo |
|---|---|---|---|
| `customer@example.com` | CUSTOMER | ACTIVE | Search, book, pay (demo), cancel, my bookings |
| `staff@example.com` | STAFF | ACTIVE | Search and open or cancel any PNR. Can't book (`403`) |
| `admin@example.com` | ADMIN | ACTIVE | Same as staff |
| `locked@example.com` | CUSTOMER | LOCKED | Login is refused (only `ACTIVE` accounts get in) |
| `suspended@example.com` | CUSTOMER | SUSPENDED | Login is refused |

### Seed network

From `database/c3-booking/seed_dev.sql`. Every train runs daily, for the 30 days after the database was built.

| Train | Route (stop order) | Classes and coaches |
|---|---|---|
| **12952** Mumbai Rajdhani Express | NDLS → KOTA → BRC → BCT | 1A ×1 (H1, 18 berths, no RAC), 2A ×2 (A1–A2), 3A ×3 (B1–B3) |
| **12622** Tamil Nadu Express | NDLS → BPL → NGP → MAS | 2A ×1 (A1, 48 berths, 4 RAC), 3A ×2 (B1–B2), SL ×4 (S1–S4) |
| **12127** Mumbai Pune Intercity | CSMT → PUNE | 2S ×4 (D1–D4, sitting) |

---

## 7. A 5-minute demo

Log in as `customer@example.com` / `Railway@Dev123`.

**Optional setup (10 seconds, before the audience arrives).** This fills the Tamil Nadu Express in 2A, **7 days from today**, so the RAC and waitlist part of the demo has something to show. It makes 8 confirmed bookings of 6 passengers (all 48 berths) and one booking of 3, which gets RAC 1 to 3. They are ordinary bookings of `customer@example.com`, so they show up under My bookings.

```bash
set -a; source .env; set +a
psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  u   INT := (SELECT user_id FROM users WHERE email = 'customer@example.com');
  r   INT := (SELECT run_id FROM train_run WHERE train_no = '12622' AND run_date = CURRENT_DATE + 7);
  pax JSONB;
BEGIN
  FOR i IN 1..9 LOOP
    SELECT jsonb_agg(jsonb_build_object('name', 'Filler ' || i || '-' || n, 'age', 30, 'gender', 'M'))
      INTO pax FROM generate_series(1, CASE WHEN i <= 8 THEN 6 ELSE 3 END) AS n;
    PERFORM confirm_booking(create_booking(u, r, '2A', 'GN', 1, 4, pax));   -- NDLS (stop 1) -> MAS (stop 4)
  END LOOP;
END $$;
SQL
```

### Part 1: a normal booking

1. **Search.** From `NDLS` to `BCT`, any date in the next few days. The Mumbai Rajdhani (12952) appears with availability and fare per class (1A / 2A / 3A).
2. **Availability.** Point out free berths, RAC and waitlist per class. Then search `NDLS` → `KOTA` on the same date: fares are by distance, and availability is for that journey only.
3. **Book 3 passengers** in 3A, NDLS → BCT. Make one of them 66 years old.
   - The PNR page opens. The booking is **HELD**, with a 15-minute countdown.
   - Each passenger already has a berth (`CNF/B1/1/LB`, ...).
   - Explain that the berths are held, not sold. If nobody pays, `expire_holds()` releases them within a minute of the hold running out.
4. **Pay.** The booking becomes **CONFIRMED** and `total_fare` is now fixed. This is the demo-mode stand-in for Team 4's Razorpay payment. Underneath it is the same `confirm_booking(pnr)` that Team 4 calls.
5. **Cancel one passenger.** Their label becomes `CAN` and their berth is free again. The others keep their berths.

### Part 2: RAC and waitlist

6. **RAC and waitlist.** Search `NDLS` → `MAS` for the date **7 days from today** (the date filled in the setup). The Tamil Nadu Express (12622) shows 2A with 0 berths free and 1 RAC place left.
   - Book 2 passengers in 2A. The first gets **`RAC 4`**, the second **`WL 1`**.
   - Pay, so the booking is CONFIRMED and keeps its queue places.
7. **Promotion.** Open **My bookings**. Find the filler booking with 3 passengers (the RAC 1–3 one) and cancel it.
   - Back on your PNR: your RAC passenger's position has gone from `RAC 4` to **`RAC 1`**, and your waitlisted passenger has moved into a freed RAC place (**`RAC 2`**).
   - Then cancel one passenger of a 6-passenger filler booking. That frees a berth, and the first in the RAC queue gets it: your passenger is now **`CNF/A1/<berth>/<type>`**, and the other moves up to `RAC 1`.
   - `promote_queue` serves RAC first, then the waitlist, in queue order.
8. **My bookings.** Every PNR with its status, journey, passenger count and fare.

### Extras, if there's time

- Log in as `staff@example.com` and open your PNR with **PNR lookup**. Staff can see any PNR, but booking is refused.
- Try 7 passengers, or an age of 0, or a station the train doesn't stop at. Each error comes back from a named database rule (`chk_passenger_age`, `trg_booking_valid_stops`, ...).
- Mention the race test: 10 sessions fight for the last berth, exactly one wins, and the other nine are waitlisted ([§8](#8-tests)).

Without the optional setup, you can still show the waitlist on the Rajdhani's 1A, which has 18 berths and no RAC: fill it with three bookings of 6 passengers, and the next booking gets `WL 1`.

---

## 8. Tests

Both suites build their own throwaway database with `database/setup.sh`, so they don't touch `railway`. Run them from the repo root:

```bash
export PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=...

./database/c3-booking/tests/run_tests.sh   # database tests: every rule, trigger and procedure, plus the 10-session race
./booking-service/run_tests.sh             # API tests (JUnit, against railway_test)
```

- **Database tests** (`database/c3-booking/tests/`):
  - Build `railway_c3_test` and run every check inside a rolled-back transaction.
  - Constraint tests check the SQLSTATE *and* the constraint name, so a test can't pass because a different rule fired.
  - Then the race test runs, and the database is dropped.
- **booking-service tests:**
  - Rebuild `railway_test`, then run `./mvnw test`: token rules, who can reach which endpoint, search and availability, and the booking flows (confirmed, waitlisted, promoted after a cancellation, hold expiry, each database rule coming back as the right HTTP error).
  - They refuse to run on a database whose name doesn't end in `_test`.

The frontend has no tests; `cd frontend && npm run build` checks that it compiles.

CI (`.github/workflows/ci.yml`) runs all three (database tests, booking-service tests and the frontend build) on every pull request.

---

## 9. What was removed from this branch

`team3` had merged `main` early, so it also carried other teams' code. This branch keeps only what the Team 3 demo needs:

| Removed | Owner | Why |
|---|---|---|
| `src/`, `pom.xml`, `mvnw`, `mvnw.cmd`, `.mvn/` (repo root) | Team 4: payments, refunds, concessions (Razorpay) | Replaced by the demo-pay stand-in |
| `backend/` | Team 1: Node.js auth server (needs MongoDB) | Replaced by the demo login stand-in |
| `docs/API.md` | Team 1: contract of the auth API in `backend/` | Its server is gone |
| `decoded_image.jpg` | stray file | |
| Frontend payment, refund and concession screens | Team 4 | Not part of the demo |

**Kept** from other teams:
- `database/c1-identity/` (Team 1's SQL only). The `users` table and the dev accounts are needed: `booking.user_id` references `users`, and `setup.sh` builds C1 before C3.
- The network and concession placeholders in `database/c3-booking/`, which Team 3 wrote for Teams 2 and 4.
