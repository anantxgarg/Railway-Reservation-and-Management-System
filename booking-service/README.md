# Booking Service (Team 3)

REST API for search, availability, bookings, PNR status and cancellation. Spring Boot 3.3 / Java 17, port **8082**.

The booking rules (seat allocation, RAC and waitlist, holds, cancellations, no double booking) live in the database, in [`database/c3-booking/`](../database/c3-booking/README.md). This service does three things:
- checks who is calling (Team 1's tokens);
- calls the C3 functions and views through `JdbcTemplate` (no Hibernate, no Flyway);
- turns database errors into HTTP errors.

> **Standalone demo branch:** Team 1's login backend and Team 4's payments app are removed from this branch. Run the service in [demo mode](#demo-mode-standalone-without-team-1--team-4) (`BOOKING_DEMO=true`), which stands in for them. The sections below that send you to Team 1's login or Team 4's payments and refunds describe the integrated system.

## Run

1. Build the shared database (see the root README): `PGHOST=localhost PGUSER=postgres ./database/setup.sh`
2. Start the service with the **same `JWT_SECRET` as Team 1's backend**:

```bash
cd booking-service
PGHOST=localhost PGUSER=postgres PGPASSWORD=... JWT_SECRET=<Team 1's secret> ./mvnw spring-boot:run
```

On Windows use `mvnw.cmd` and set the variables with `set NAME=value` first.

| Variable | Default | |
|---|---|---|
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | `localhost`, `5432`, `railway`, `postgres`, empty | Same variables as `setup.sh` and Team 1 |
| `JWT_SECRET` | none, so the service won't start without it | Team 1's signing secret, at least 32 bytes |
| `BOOKING_PORT` | `8082` | |

Unpaid holds are expired every minute (`CALL expire_holds()`). Change the interval with `booking.expire-holds.interval-ms`, or turn the job off with `booking.expire-holds.enabled=false`.

## Logging in

Log in through Team 1 (`POST http://localhost:3000/api/auth/login`). Then send the returned `token` as `Authorization: Bearer <token>`.

On every request the service checks the token and then rereads the account from the database, the same way Team 1's middleware does:
- **Token rules:** HS256 only, issuer `railway-api`, audience `railway-client`.
- **Account checks:** the account must still be `ACTIVE`, and its role is taken from the database rather than from the token.

Dev accounts: `customer@example.com`, `staff@example.com`, `admin@example.com`, password `Railway@Dev123`.

## Endpoints

| Method | Path | Who | What |
|---|---|---|---|
| GET | `/api/search?from=NDLS&to=MAS&date=2026-11-02` | anyone | Trains that stop at `from` and later at `to`, leaving `from` on `date`, with availability and fare per class. A placeholder until Team 2 builds search. |
| GET | `/api/runs/{runId}/availability?class=3A&from=NDLS&to=NGP` | anyone | Seats, RAC and waitlist per class for a journey. All parameters are optional; without `from`/`to` the whole route is used. |
| POST | `/api/bookings` | CUSTOMER | Book and hold for 15 minutes. Returns `201` with the booking. |
| GET | `/api/bookings/mine` | any logged-in user | The caller's bookings, newest first. |
| GET | `/api/bookings/{pnr}` | owner, STAFF, ADMIN | PNR status with every passenger. |
| POST | `/api/bookings/{pnr}/cancel` | owner, STAFF, ADMIN | Cancel some passengers of an **unpaid** booking (`{"passengerIds": [12, 13]}`), or everyone (no body). Paid bookings: `409 PAID_BOOKING`; cancel them through Team 4's `POST /api/refunds`. |

Fares shown by search and availability are per passenger, for the general quota without concession.

A customer asking for someone else's PNR gets `404`, not `403`, so nobody can probe which PNRs exist.

### Book

```http
POST /api/bookings
Authorization: Bearer <token>
Content-Type: application/json

{
  "runId": 23,
  "classCode": "3A",
  "quotaCode": "GN",
  "from": "NDLS",
  "to": "NGP",
  "passengers": [
    {"name": "Asha Rao", "age": 34, "gender": "F"},
    {"name": "Ravi Rao", "age": 66, "gender": "M", "concessionId": null}
  ]
}
```

- `quotaCode` is optional and defaults to `GN`.
- Codes are case-insensitive.
- `gender` is `M`, `F` or `O`.
- A booking has 1 to 6 passengers.

The response (and `GET /api/bookings/{pnr}`) looks like this:

```json
{
  "pnr": "1000000016", "userId": 1, "status": "HELD",
  "holdExpiresAt": "2026-10-20T18:54:58Z", "createdAt": "2026-10-20T18:39:58Z",
  "trainNo": "12622", "trainName": "Tamil Nadu Express", "runId": 23,
  "runDate": "2026-10-28", "journeyDate": "2026-10-28",
  "classCode": "3A", "className": "Third AC", "quotaCode": "GN",
  "from": {"seq": 1, "code": "NDLS", "name": "New Delhi"},
  "to": {"seq": 3, "code": "NGP", "name": "Nagpur Junction"},
  "totalFare": 5555.00,
  "passengers": [
    {"passengerId": 1, "passengerNo": 1, "name": "Asha Rao", "age": 34, "gender": "F",
     "status": "CONFIRMED", "label": "CNF/B1/1/LB", "queueNo": null, "currentPosition": null,
     "coachNo": "B1", "berthNo": "1", "berthType": "LB", "fare": 2777.50, "cancelledAt": null}
  ]
}
```

`label` reads like a ticket: `CNF/B1/1/LB`, `RAC 3`, `WL 12`, `CAN`. `currentPosition` is the passenger's current place in the RAC or waitlist queue, and `null` otherwise.

### Cancel

For a booking that hasn't been paid yet (`HELD`):
- The response lists the cancelled passengers and their fares, plus the updated booking.
- `totalFare` drops, because only the passengers still on the booking are charged.

A paid booking (`CONFIRMED`) returns `409 PAID_BOOKING`. Cancel it through Team 4's `POST /api/refunds` instead, which cancels the passengers and issues the refund in one transaction.

Paying works the same way: Team 4's `POST /api/payments/order {"pnr": ...}` and the Razorpay checkout. A successful payment confirms the booking.

## Demo mode (standalone, without Team 1 / Team 4)

For demonstrating Team 3 on its own, with only PostgreSQL and this service running. Turn it on with `BOOKING_DEMO=true` (property `booking.demo.enabled`, default `false`):

```bash
cd booking-service
BOOKING_DEMO=true JWT_SECRET=any-string-of-at-least-32-bytes-0123456789 \
PGHOST=localhost PGUSER=postgres PGPASSWORD=... ./mvnw spring-boot:run
```

`JWT_SECRET` can be any value of at least 32 bytes, because this service both issues and checks the tokens. The code is in `com.railway.booking.demo` and doesn't exist at all when demo mode is off, so the integrated behaviour is unchanged. Never turn it on next to the real Team 1 and Team 4 services.

What it adds:

- **Login, a stand-in for Team 1.** Same paths, JSON and error bodies as Team 1's backend, so the frontend works unchanged (point the Vite `/api/auth` proxy at port 8082). Passwords are checked against the bcrypt hashes in C1's `users` table, and only `ACTIVE` accounts may log in. Access tokens are Team 1's: HS256, 15 minutes, `sub` = user id, `role` claim. Refresh tokens are kept in memory, rotate on every use, and are revoked on logout; a restart logs everyone out. Failed logins are not counted and nothing locks.

  | Method | Path | Body | Response |
  |---|---|---|---|
  | POST | `/api/auth/login` | `{"email", "password"}` | `200 {"message": "Login successful", "token", "refreshToken", "user": {"userId", "name", "email", "role"}}`; `401 INVALID_CREDENTIALS`; `403 ACCOUNT_NOT_ACTIVE` (locked, suspended, ...); `400 VALIDATION_ERROR` with `fields` |
  | POST | `/api/auth/refresh` | `{"refreshToken"}` | `200 {"token", "refreshToken"}`; `401 INVALID_REFRESH_TOKEN` / `EXPIRED_REFRESH_TOKEN` |
  | POST | `/api/auth/logout` | Bearer token | `200 {"message": "Logged out successfully"}` |
  | GET | `/api/auth/me` | Bearer token | `200 {"userId", "name", "email", "phone", "role", "status", "createdAt", "lastLoginAt"}` |

- **Payment, a stand-in for Team 4.** `POST /api/bookings/{pnr}/demo-pay` (no body, owner only) calls `confirm_booking(pnr)`, just as Team 4 does after a successful payment, and returns the booking as `GET /api/bookings/{pnr}` does. No money changes hands. An already paid booking, an expired hold or a cancelled booking returns `409 WRONG_STATE`. Another customer gets `404`, and STAFF/ADMIN get `403`.
- **Cancelling after payment.** The owner may cancel passengers of a paid (`CONFIRMED`) booking through `POST /api/bookings/{pnr}/cancel`, so the demo can show seats being released and RAC/waitlist promotion. No refund is issued. `bookingWasPaid: true` and `cancelledFare` say what Team 4 would have refunded. STAFF/ADMIN still get `409 PAID_BOOKING`.

## Errors

Every error uses Team 1's shape: `{"error": {"code": "...", "message": "...", "constraint": "..."}}`. `constraint` names the database rule that refused the request, when there is one.

| HTTP | code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Malformed request: missing field or parameter, not JSON, 0 or more than 6 passengers |
| 401 | `MISSING_TOKEN`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `USER_NOT_FOUND`, `ACCOUNT_NOT_ACTIVE` | Not logged in, or the token or account isn't valid |
| 403 | `FORBIDDEN` | Role not allowed, e.g. STAFF trying to book |
| 404 | `NOT_FOUND` | Unknown run or PNR, or someone else's PNR |
| 409 | `WRONG_STATE` | Train already left or run cancelled, booking already cancelled, hold expired |
| 409 | `PAID_BOOKING` | Cancelling a paid booking here; use Team 4's refunds |
| 409 | `CONFLICT` | Clashed with a concurrent request; retry |
| 422 | `INVALID_INPUT` | Station not on the route, unknown quota or concession, bad passenger list |
| 422 | `RULE_VIOLATION` | A database rule refused it, e.g. `chk_passenger_age` or `trg_booking_class_on_train` |

The database raises standard SQLSTATEs, and `ApiExceptionHandler` maps them to these codes.

## Tests

```bash
PGHOST=localhost PGUSER=postgres ./booking-service/run_tests.sh
```

Rebuilds `railway_test` with `setup.sh --reset`, then runs 57 tests:
- **Token rules** (unit tests).
- **Access rules:** who can reach which endpoint.
- **Search and availability.**
- **Booking flows:** confirmed, waitlisted, and promoted after a cancellation; partial and full cancellation; ownership; hold expiry; each database rule coming back as the right HTTP error; demo endpoints absent by default.
- **Demo mode** (`DemoModeApiTest`, with `booking.demo.enabled=true`): login, refresh, logout and `/me`; locked accounts; demo-pay; cancelling a paid booking and the waitlist moving up.

Each API test runs in a transaction that is rolled back. The tests refuse to run on a database whose name doesn't end in `_test`.

Team 1's database tests also use `railway_test` by default, and this script drops and rebuilds it.
