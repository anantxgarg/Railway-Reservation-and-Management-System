# Railway Reservation & Management System

Full-stack Railway Reservation & Management System featuring ticket booking, PNR generation, seat inventory, payments, live train status, notifications, feedback and role-based access control (RBAC). Every team's work runs as one system: one login, one shared database, one frontend.

---

## Architecture & Team Modules

| Team | Module | Responsibility | Tech Stack | Folder |
|---|---|---|---|---|
| **Team 1** | Users & Auth | Authentication, JWT & refresh tokens, RBAC, password reset, audit logging; login, registration and admin pages | Node.js, Express, PostgreSQL, MongoDB, Brevo API, React | `backend/`, `database/c1-identity/`, `frontend/src/pages/` |
| **Team 2** | Trains, Stations, Routes | Stations, trains, routes and timetables, weekly schedules, dated runs with status and delay, coaches and seats, live train status | Spring Boot, PostgreSQL, React | `train-service/`, `database/c2-network/`, `frontend/src/features/network/` |
| **Team 3** | Booking, PNR, Seats | Search, booking, PNR generation, seat allocation, RAC and waitlist, cancellation | Spring Boot, PostgreSQL, React | `booking-service/`, `database/c3-booking/`, `frontend/src/features/booking/` |
| **Team 4** | Payments & Refunds | Razorpay payments, refund policy, concessions | Spring Boot, Razorpay, React | repo root (`src/`, `pom.xml`), `frontend/src/components/` |
| **Team 5** | Reports & Analytics | Reports, analytics, admin dashboards | TBD | Not started (`v_user_bookings`, `notification_outbox` and Team 6's feedback summary are ready to report on) |
| **Team 6** | Notifications, Status, Feedback | Notifications, live train status page, journey feedback | Spring Boot, MongoDB, React | `notification-service/`, `frontend/src/features/{notifications,feedback,livestatus}/` |

**How the teams connect**

- **One login.** Team 1 issues JWTs; every other backend verifies them with the same `JWT_SECRET`, so a user logs in once.
- **One PostgreSQL database**, `railway`, built by `database/setup.sh` in dependency order: C1 identity → C2 network → C3 booking; Team 4's tables come from its Flyway migrations. Team 6 keeps notifications and feedback in MongoDB.
- **Network → booking.** Booking (C3) books seats on Team 2's runs, routes and coaches, and refuses runs Team 2 marks `CANCELLED` or `ARRIVED`. Search shows Team 2's timetable times.
- **Booking → payments.** Payments charges `booking.total_fare` and confirms the booking (`confirm_booking`) in the same transaction; refunds cancel passengers (`cancel_passengers`) in the same transaction as the refund, with the refund window measured from Team 2's departure time.
- **Everyone → notifications.** Events go into `notification_outbox` in the same transaction as the change: paid bookings and waitlist/RAC promotions (C3 triggers), payments and refunds (Team 4), cancellations and journey reminders (Team 3), completed journeys (Team 2, when staff mark a run `ARRIVED`). booking-service delivers them to Team 6 with Team 6's `NotificationHandle`; a "journey completed" notification opens Team 6's feedback form.
- **Live status.** Team 6's page shows Team 2's `GET /api/live-status/pnr/{pnr}`: timetable plus the delay staff report.
- **One frontend.** A single React app; Team 1's routing and session handling are the shell, every team's screens are tabs in it.

---

## Running everything

Five backends, one PostgreSQL database, one MongoDB and one React app. In development the app's dev server forwards each `/api` path to the backend that owns it, so the browser only talks to http://localhost:5173.

| Service | Folder | Port | Owns |
|---|---|---|---|
| Users & Auth (Team 1) | `backend/` | 3000 (`PORT`) | `/api/auth`, `/api/users`, `/api/admin` |
| Payments (Team 4) | repo root | 8081 (`PAYMENTS_PORT`) | `/api/payments`, `/api/refunds`, `/api/concessions` |
| Booking (Team 3) | `booking-service/` | 8082 (`BOOKING_PORT`) | `/api/search`, `/api/runs`, `/api/bookings` |
| Trains (Team 2) | `train-service/` | 8083 (`TRAIN_PORT`) | `/api/trains`, `/api/stations`, `/api/travel-classes`, `/api/coaches`, `/api/routes`, `/api/route-stations`, `/api/schedules`, `/api/live-status` |
| Notifications (Team 6) | `notification-service/` | 8086 (`NOTIFICATIONS_PORT`) | `/api/notifications`, `/api/feedback`, `/api/demo` |
| Frontend (all teams) | `frontend/` | 5173 | the screens |

### Prerequisites

- **PostgreSQL 14+**, with `psql` on the `PATH` (`setup.sh` uses it).
- **MongoDB 6+**, for Team 6's notifications and feedback. Team 1 also writes its audit log there when it can (optional for Team 1).
- **Node.js 18+**, for Team 1's backend and the frontend.
- **Java 17+.** Maven is not needed: every Spring Boot app has a `./mvnw` wrapper (`mvnw.cmd` on Windows).
- **Razorpay test-mode keys**, to take payments (Team 4, see below).

### 1. Build the shared database

All teams share one database, `railway`. `database/setup.sh` builds it from each team's SQL in dependency order: C1 identity, C2 network, C3 booking, with development data (users, 6 trains with runs for the next 30 days).

```bash
PGHOST=localhost PGUSER=postgres PGPASSWORD=... ./database/setup.sh            # create and fill "railway"
PGHOST=localhost PGUSER=postgres PGPASSWORD=... ./database/setup.sh --reset    # drop and rebuild it
```

Team 4's tables are created by the payments app itself (Flyway) the first time it starts, so it must start **after** this step.

### 2. Environment variables

| Variable | Used by | Value |
|---|---|---|
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | `setup.sh` and every PostgreSQL backend | The same everywhere. Defaults: `localhost`, `5432`, `railway`, `postgres` |
| `JWT_SECRET` | all five backends | **One shared secret**, at least 32 characters. Team 1 signs logins with it; the others check the tokens with it |
| `NOTIFICATIONS_API_KEY` | booking-service and notification-service | Any string, the same for both; booking-service sends it when delivering notifications. Leave unset in development to skip the check |
| `TEAM6_MONGO_URI` | notification-service | Default `mongodb://localhost:27017/team6_railway` |
| `MONGO_URI` | Team 1 | e.g. `mongodb://localhost:27017/railway` (audit log) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | payments | Razorpay test-mode keys; the webhook secret is any string you also enter in the Razorpay dashboard |
| `PORT`, `PAYMENTS_PORT`, `BOOKING_PORT`, `TRAIN_PORT`, `NOTIFICATIONS_PORT` | the backends | Only to change the ports above |
| `NOTIFICATIONS_URL` | booking-service (and the frontend dev server) | Where notification-service runs, default `http://localhost:8086` |
| `AUTH_URL`, `BOOKING_URL`, `PAYMENTS_URL`, `TRAIN_URL`, `NOTIFICATIONS_URL` | frontend dev server | Only when a backend isn't on its default port, e.g. `PAYMENTS_URL=http://localhost:8091` |

Team 1 reads `backend/.env` (copy `backend/.env.example`; see Team 1 below). The Spring Boot apps and the frontend read the environment.

Generate a secret once and use it for all of them: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

### 3. Start the services

Each in its own terminal, after step 1. The backends don't depend on each other at startup, but the payments app needs the booking tables, and notifications wait in the database until notification-service is up.

```bash
# shared by the terminals below
export PGHOST=localhost PGUSER=postgres PGPASSWORD=...
export JWT_SECRET=<the shared secret>
export NOTIFICATIONS_API_KEY=<any string>

cd backend && npm ci && npm start                      # Team 1, :3000 (reads backend/.env)
cd train-service && ./mvnw spring-boot:run             # Team 2, :8083
cd booking-service && ./mvnw spring-boot:run           # Team 3, :8082
RAZORPAY_KEY_ID=rzp_test_... RAZORPAY_KEY_SECRET=... RAZORPAY_WEBHOOK_SECRET=... \
  ./mvnw spring-boot:run                               # Team 4, :8081, from the repo root
cd notification-service && ./mvnw spring-boot:run      # Team 6, :8086 (needs MongoDB)
cd frontend && npm ci && npm run dev                   # :5173
```

On Windows use `mvnw.cmd`, and `set NAME=value` instead of `export`.

Open http://localhost:5173 and log in as `customer@example.com` with password `Railway@Dev123` (`staff@` and `admin@example.com` too). Book a ticket from `NDLS` to `MAS`, `BCT` or `NGP`, or between `PUNE`, `CSMT`, `SUR` and `UBL`, on any of the next 30 days, then pay with Razorpay's test card `4111 1111 1111 1111`. The bell shows the notifications. As `staff@example.com`, the Trains tab sets a run's status and delay: live status follows, and marking a run `ARRIVED` asks its passengers for feedback.

### Tests

| Suite | Command | Database |
|---|---|---|
| Team 1 unit | `cd backend && npm test` | none |
| Team 1 database | `PGDATABASE=railway_test ./database/setup.sh --reset && cd backend && npm run test:db` | `railway_test` |
| C2 network database | `./database/c2-network/tests/run_tests.sh` | creates and drops `railway_c2_test` |
| Train API | `./train-service/run_tests.sh` | rebuilds `railway_test` |
| C3 database | `./database/c3-booking/tests/run_tests.sh` | creates and drops `railway_c3_test` |
| Booking API | `./booking-service/run_tests.sh` | rebuilds `railway_test` |
| Payments | `PGDATABASE=railway_test ./database/setup.sh --reset && ./mvnw test` | `railway_test` |
| Notifications | `cd notification-service && ./mvnw test` | MongoDB `team6_test` (`TEAM6_TEST_MONGO_URI`, default `mongodb://localhost:27017/team6_test`) |
| Frontend | `cd frontend && npm run build` | none |

The PostgreSQL suites need the `PG*` variables; none of them touch `railway`. Razorpay is mocked in the payments tests, so they need no keys. Several suites rebuild `railway_test`, so run them one at a time. CI (`.github/workflows/ci.yml`) runs all of them on every pull request.

### Troubleshooting

- **Every call to the Spring Boot services returns 401 after logging in.** The backends don't share the same `JWT_SECRET`.
- **The payments app stops at startup with a Flyway error about `booking`.** The shared database hasn't been built yet; run step 1 first.
- **Port 8081 (or another) is already in use.** Start the app on another port (`PAYMENTS_PORT=8091`) and tell the frontend (`PAYMENTS_URL=http://localhost:8091 npm run dev`).
- **No notifications arrive.** Check notification-service is running and MongoDB is up, and that `NOTIFICATIONS_API_KEY` is the same for booking-service and notification-service. Undelivered ones wait in `notification_outbox` (`last_error` says why) and are retried.
- **The `booking` foreign key to `users` disappeared.** Team 1's `schema.sql` drops `users` with `CASCADE`. Rebuild everything with `setup.sh --reset` instead of rerunning one team's files.

---

## Team 1 — Users & Auth

The authentication backend provides secure user identity management, credential hashing, session tokens, account lockout protection, and transactional email password resets.

Detailed API specifications, request/response schemas, and error codes are documented in [`docs/API.md`](docs/API.md).
Database schemas and role-permission matrices are documented in [`database/c1-identity/README.md`](database/c1-identity/README.md).

Team 1's pages (login, registration, forgot/reset password, admin login, account and admin portals) and the app's routing and session handling are in the shared [`frontend/`](frontend/README.md) (`src/pages`, `src/context`, `src/services`). Every other backend accepts the tokens issued here. Integration notes: [`docs/team-1-integration-handover.md`](docs/team-1-integration-handover.md).

### Prerequisites

- **Node.js**: `v18.0.0` or higher (`v20+` recommended)
- **PostgreSQL**: `14+` (running locally or accessible over network, port `5432`)
- **MongoDB**: `6+` (for audit logging, port `27017`)

### Setup & Installation

1. **Navigate to the backend directory and install dependencies:**

   ```bash
   cd backend
   npm install
   ```

2. **Configure Environment Variables:**

   Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

   Configure the local variables in `backend/.env` (never commit this file):

   | Variable | Description | Default / Example |
   |---|---|---|
   | `PGHOST` | PostgreSQL host | `localhost` |
   | `PGPORT` | PostgreSQL port | `5432` |
   | `PGDATABASE` | Application database name | `railway` |
   | `PGUSER` | Database user | `postgres` |
   | `PGPASSWORD` | Database password | *your_local_password* |
   | `MONGO_URI` | MongoDB connection URI for audit logging | `mongodb://localhost:27017/railway` |
   | `JWT_SECRET` | Secret key for signing HS256 access tokens (min 64 chars) | *random_64_char_hex_string* |
   | `JWT_EXPIRES_IN` | Access token lifespan | `15m` |
   | `REFRESH_TOKEN_EXPIRES_DAYS` | Refresh token lifespan | `7` |
   | `RESET_TOKEN_EXPIRES_MINUTES`| Password reset token lifespan | `60` |
   | `DEV_EXPOSE_RESET_TOKEN` | Expose raw reset token in API responses (dev only) | `false` |
   | `BREVO_API_KEY` | Brevo Transactional Email API v3 key | `your_brevo_api_key_here` |
   | `EMAIL_FROM` | Sender address verified in Brevo | `"Railway Reservation" <noreply@yourdomain.com>` |
   | `FRONTEND_URL` | Frontend client base URL for reset links | `http://localhost:5173` |
   | `LOGIN_LOCKOUT_THRESHOLD` | Consecutive failed logins before account locks | `5` |
   | `PORT` | Backend HTTP port | `3000` |
   | `NODE_ENV` | Environment mode (`development`, `test`, `production`) | `development` |
   | `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:5173` |

   > **Note:** Generate a secure JWT secret with:
   > ```bash
   > node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   > ```

3. **Initialize the Database:**

   To build the shared database with every team's tables, use `database/setup.sh` (see [Running everything](#running-everything)). To build only C1, run the scripts in order against the `railway` database:

   ```bash
   createdb railway
   psql -d railway -v ON_ERROR_STOP=1 -f database/c1-identity/schema.sql
   psql -d railway -v ON_ERROR_STOP=1 -f database/c1-identity/schema_auth_tokens.sql
   psql -d railway -v ON_ERROR_STOP=1 -f database/c1-identity/seed.sql
   psql -d railway -v ON_ERROR_STOP=1 -f database/c1-identity/seed_dev_users.sql
   ```

   *(Optional: Initialize MongoDB audit log schema via `mongosh "mongodb://localhost:27017/railway" database/c1-identity/mongo/audit_log.js`)*

### Starting the Server

- **Development mode (with nodemon auto-reload):**
  ```bash
  cd backend
  npm run dev
  ```
- **Production mode:**
  ```bash
  cd backend
  npm start
  ```

**Health Check:**
```bash
curl http://localhost:3000/health
# Response: {"status":"ok","timestamp":"2026-10-19T00:00:00.000Z"}
```

### Running Tests

The test suite includes both offline unit tests (mocked DB and Brevo) and live PostgreSQL integration tests.

- **Offline Unit Tests (174 tests):**
  ```bash
  cd backend
  npm test
  ```
- **Database Integration Tests (46 tests):**
  ```bash
  cd backend
  npm run test:db
  ```
  *Note: Integration tests strictly require a separate `railway_test` database. Built-in safety guards (`tests/helpers/dbGuard.js`) refuse to run against the production/dev `railway` database.*

### Authentication API Endpoints Summary

All request bodies and responses use JSON (`Content-Type: application/json`).

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register new `CUSTOMER` account with bcrypt hash |
| `POST` | `/api/auth/login` | Public | Authenticate with email/password; returns access & refresh tokens |
| `POST` | `/api/auth/admin-login` | Public | Same check, but only an `ACTIVE` `ADMIN` gets tokens (admin portal) |
| `GET` | `/api/auth/me` | Authenticated | Retrieve profile for authenticated user (`req.user`) |
| `POST` | `/api/auth/logout` | Authenticated | Revoke refresh token and terminate session |
| `POST` | `/api/auth/refresh` | Public | Rotate refresh token and issue new access token pair |
| `POST` | `/api/auth/change-password` | Authenticated | Change password and revoke all active refresh tokens |
| `POST` | `/api/auth/forgot-password` | Public | Request password reset email via Brevo transactional API |
| `POST` | `/api/auth/reset-password` | Public | Reset password using one-time token |
| `GET` | `/api/users` | Admin (`MANAGE_USERS`) | Paginated user management list |
| `POST` | `/api/admin/users/:id/unlock` | Admin (`MANAGE_USERS`) | Unlock account locked by failed login attempts |
| `POST` | `/api/admin/staff` | Admin (`MANAGE_STAFF`) | Create staff user via atomic procedure |

### Development Test Accounts

Configured in `database/c1-identity/seed_dev_users.sql` (all use password: `Railway@Dev123`):

| Email | Role | Status | Description |
|---|---|---|---|
| `customer@example.com` | `CUSTOMER` | `ACTIVE` | Standard passenger user |
| `staff@example.com` | `STAFF` | `ACTIVE` | Railway staff user (Reservations, NDLS) |
| `admin@example.com` | `ADMIN` | `ACTIVE` | System administrator with full permissions |
| `locked@example.com` | `CUSTOMER` | `LOCKED` | Account locked for lockout testing |
| `suspended@example.com` | `CUSTOMER` | `SUSPENDED` | Suspended account testing |

---

## Team 2 — Trains, Stations & Routes

The railway network: stations, trains, routes with their timetable, weekly schedules, dated runs with status and delay, coaches and seats, and live train status.
- **Database:** [`database/c2-network/`](database/c2-network/README.md) is the shared network schema every team uses (it replaced Team 3's placeholder copy), with Team 2's functions (`get_route_distance`, `calculate_fare`, `stop_departure_at`, ...), trigger and views. Columns and rules: [data dictionary](database/c2-network/DATA_DICTIONARY.md).
- **API:** [`train-service/`](train-service/README.md), Spring Boot on port 8083. Reading is public; staff set run status and delay; admins change the network. It accepts Team 1's login tokens, so it needs the same `JWT_SECRET`.
- **Screens:** the Trains tab of the [frontend](frontend/README.md) (`src/features/network/`): timetables for everyone, the day's runs for staff.

```bash
cd train-service && PGHOST=localhost PGUSER=postgres JWT_SECRET=<Team 1's secret> ./mvnw spring-boot:run
```

Tests:

```bash
PGHOST=localhost PGUSER=postgres ./database/c2-network/tests/run_tests.sh   # database; builds and drops railway_c2_test
PGHOST=localhost PGUSER=postgres ./train-service/run_tests.sh             # API; rebuilds railway_test
```

The first version of train-service connected to a hosted (Neon) database with its password in the code. That password is still in the `team2` branch's history and must be **rotated** in the Neon console; the service now uses the shared database through the `PG*` variables.

---

## Team 3 — Booking, PNR & Seats

Search, availability, booking, PNR status and cancellation, with seat allocation, RAC and waitlist.
- **Database:** [`database/c3-booking/`](database/c3-booking/README.md) holds the tables, triggers, procedures and views where the booking rules live, on top of Team 2's network tables. Its `concession_rule` table is Team 4's list of concessions, applied at booking. `08_notifications.sql` is the notification outbox for Team 6.
- **Notifications:** booking-service delivers `notification_outbox` to Team 6's notification-service every few seconds (with Team 6's `NotificationHandle`), and queues journey reminders 24 hours before departure. Set `NOTIFICATIONS_URL` and `NOTIFICATIONS_API_KEY` if notification-service isn't on its defaults.
- **API:** [`booking-service/`](booking-service/README.md), Spring Boot on port 8082. It accepts Team 1's login tokens, so it needs the same `JWT_SECRET`.

```bash
PGHOST=localhost PGUSER=postgres ./database/setup.sh                      # shared database
cd booking-service && PGHOST=localhost PGUSER=postgres JWT_SECRET=<Team 1's secret> ./mvnw spring-boot:run
```

The screens (search, passengers, review and pay, PNR status, my bookings) are in [`frontend/`](frontend/README.md). The tables, rules and views are listed in the [data dictionary](database/c3-booking/DATA_DICTIONARY.md).

Tests:

```bash
PGHOST=localhost PGUSER=postgres ./database/c3-booking/tests/run_tests.sh   # database; builds and drops railway_c3_test
PGHOST=localhost PGUSER=postgres ./booking-service/run_tests.sh             # API; rebuilds railway_test
```

---

## Team 4 — Payments & Refunds (Razorpay Payment Gateway)

Spring Boot 3 / Java 17 app covering **payments, refunds and passenger concessions** for bookings made through Team 3's booking service. A booking is identified by its **PNR**.

### Run

1. Build the shared database first; this app's migrations need the booking tables: `PGHOST=localhost PGUSER=postgres ./database/setup.sh`
2. Get **test mode** keys: Razorpay Dashboard → Account & Settings → API Keys.
3. Set the environment and start the app. Nothing secret is stored in `application.properties`, so the app won't start without these:
   ```bash
   export PGHOST=localhost PGUSER=postgres PGPASSWORD=...     # same as setup.sh
   export JWT_SECRET=...                                      # Team 1's secret
   export RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
   export RAZORPAY_KEY_SECRET=xxxxxxxx
   export RAZORPAY_WEBHOOK_SECRET=any_string_you_choose
   ./mvnw spring-boot:run
   ```
   The API is on port 8081. Set `PAYMENTS_PORT` to change it.

Flyway creates this app's tables (`V1`, `V2`). It baselines at version 0, so it also works on the shared database where other teams' tables already exist. Hibernate only validates the schema (`ddl-auto=validate`).

Logins are Team 1's. Every endpoint except the webhook and the concession preview needs `Authorization: Bearer <token>` from Team 1's `POST /api/auth/login`. The app's old development login (`/api/auth/login` on this port) has been removed.

The screens are in the shared React app, [`frontend/`](frontend/README.md): `components/checkout.js` (Razorpay Checkout for a PNR), `MyPayments`, `Refunds` and `Concessions`. The app no longer serves a copy of the frontend from `src/main/resources/static/`.

### Flow

```
(Team 3) POST /api/bookings          -> PNR, HELD for 15 minutes
POST /api/payments/order {pnr}       -> Razorpay order for the booking's amount (booking.total_fare)
   (browser: Razorpay Checkout)
POST /api/payments/verify            -> signature check; confirm_booking(pnr) in the same transaction
POST /api/payments/webhook           -> same result via Razorpay callback (safety net)
GET  /api/refunds/preview/{pnr}?passengerIds=...
POST /api/refunds {pnr, passengerIds} -> cancel_passengers + Razorpay refund, in one transaction
```

- **Payments that can't confirm their booking are refunded in full automatically:**
  - the 15-minute hold expired before the payment arrived;
  - passengers were dropped after the order was created, so the amount changed;
  - a second payment arrived for a booking that's already paid.
- **Cancellation and refund go together.** If Razorpay refuses the refund, the cancellation is rolled back and the passengers keep their seats.
- **Unpaid bookings** are cancelled through Team 3's booking service.

### Endpoints

All of these need a Team 1 login unless marked public. Customers only see their own bookings; for anyone else's PNR they get 404.

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/concessions/rules` | public | The concessions a passenger can be booked with (the `concession_rule` table) |
| GET | `/api/concessions/preview?category=STUDENT&baseFare=500` | public | Fare after concession |
| POST | `/api/payments/order` | CUSTOMER (owner) | `{ "pnr": "1000000016" }` |
| POST | `/api/payments/verify` | CUSTOMER (owner) | `{ razorpayOrderId, razorpayPaymentId, razorpaySignature }` |
| POST | `/api/payments/webhook` | Razorpay (HMAC signature) | Razorpay callback |
| GET | `/api/payments/booking/{pnr}` | owner, STAFF, ADMIN | Payments for a booking |
| GET | `/api/payments/my` | CUSTOMER | My payments |
| GET | `/api/refunds/preview/{pnr}?passengerIds=12,13` | owner, STAFF, ADMIN | What cancelling would refund (no ids = everyone left) |
| POST | `/api/refunds` | owner, STAFF, ADMIN | `{ "pnr": "...", "passengerIds": [12], "reason": "..." }` (no ids = everyone left) |
| GET | `/api/refunds/booking/{pnr}` | owner, STAFF, ADMIN | Refunds for a booking |
| GET | `/api/refunds/my` | CUSTOMER | My refunds |
| POST | `/api/concessions/apply` | CUSTOMER, ADMIN | `{ "pnr", "passengerId", "idCardType", "idCardNumber", "documentReferenceUrl" }`: documents for the concession the passenger was booked with |
| GET | `/api/concessions/pending`, POST `/api/concessions/{id}/review` | STAFF, ADMIN | Verify concession documents |
| GET | `/api/concessions/booking/{pnr}` | owner, STAFF, ADMIN | Applications for a booking |

### Tests

```bash
PGHOST=localhost PGUSER=postgres PGDATABASE=railway_test ./database/setup.sh --reset
PGHOST=localhost PGUSER=postgres ./mvnw test
```

The unit tests need no database. The integration tests (`web/*Test`) run against `railway_test`, with Razorpay replaced by a mock, so no real payments are made. They cover:
- order, verify and webhook;
- late, outdated and duplicate payments;
- partial and full refunds, and a refused refund rolling the cancellation back;
- concessions and logins.

### Concessions

The concessions are the rows of the shared `concession_rule` table (`database/c3-booking/seed_dev.sql`); there is no second list in this app.

| `category` | Discount | Ages |
|---|---|---|
| `SENIOR_CITIZEN` | 40% | 60 or more |
| `STUDENT` | 25% | |
| `CHILD` | 50% | 5 to 11 |
| `DIFFERENTLY_ABLED` | 50% | |
| `ARMED_FORCES` | 30% | |

1. **Booking.** Each passenger may be booked with one (`concessionId` in booking-service's `POST /api/bookings`). Team 3's `calc_fare` takes it off the distance fare (not the reservation charge), and `create_booking` refuses a passenger outside its ages.
2. **Documents.** The customer then sends the documents for it (`POST /api/concessions/apply`). The application records the concession and the discount the booking gave; a passenger booked without one can't apply.
3. **Review.** Staff approve or reject the application. A rejection is recorded; the fare isn't changed afterwards (collecting the difference is not built).

The numbers are placeholders; change them in the seed (or the table) to whatever the group agrees on.

### Refund policy (`application.properties`)

Refund is a percentage of the **amount actually paid** (after concession):

| Time before departure | Refund |
|---|---|
| 48h or more | 90% |
| 24h to 48h | 75% |
| 4h to 24h | 50% |
| under 4h | no refund (cancelling is still allowed and frees the seats) |

The refund is worked out on what was paid for the passengers being cancelled. Departure is when the train leaves the passenger's boarding station by Team 2's timetable (`stop_departure_at`); should a run have no timetable, the start of the travel day in India (00:00 IST) is used, which never gives more refund than the policy allows.

Paid bookings, payments and refunds also queue Team 6 notifications (`BOOKING_CONFIRMED`, `PAYMENT_CONFIRMED`, `BOOKING_CANCELLED` with the refund) in the same transaction; booking-service delivers them.

### Webhook setup (optional for local testing)

1. Expose your app: `ngrok http 8081`.
2. Dashboard → Webhooks → Add: URL `https://<ngrok>/api/payments/webhook`, secret = `RAZORPAY_WEBHOOK_SECRET`.
3. Enable events: `payment.captured`, `payment.failed`, `refund.processed`, `refund.failed`.

### Testing in test mode

- Card: `4111 1111 1111 1111`, any future expiry, any CVV, any OTP.
- UPI: `success@razorpay` (success) or `failure@razorpay` (failure).
- Make sure payments are set to **auto-capture** in Dashboard → Settings → Configuration → Payment Capture, otherwise they stay "authorized" and refunds will fail.

### Things to revisit

- **A rejected concession** is only recorded. The fare was already reduced at booking, so the difference should be collected, or the passenger cancelled.
- **Waitlisted passengers when the chart is prepared.** If they still have no berth, they should be refunded in full automatically.
- **A reconciliation job** for orders stuck in `CREATED`.

---

## Team 6 — Notifications, Live Status & Feedback

- **Notifications:** what happened to a user's bookings (paid, payment received, cancelled with refund, waitlist → RAC → confirmed, journey reminder, journey completed), under the bell in the app's header. Stored in MongoDB.
- **Feedback:** after a journey, the passenger rates it (1-10 in 6 categories) and can write a comment; staff see all feedback and the averages per train (`GET /api/feedback/summary`).
- **Live status:** the page that shows where a PNR's train is, from Team 2's train-service.
- **API:** [`notification-service/`](notification-service/README.md), Spring Boot + MongoDB on port 8086 (it was in `backend/`, which is Team 1's). Users see only their own notifications and feedback (Team 1 logins, same `JWT_SECRET`); other backends send with `X-Internal-Key: $NOTIFICATIONS_API_KEY`. What each notification type carries: [`NOTIFICATION_TYPES.md`](notification-service/NOTIFICATION_TYPES.md).
- **Screens:** the bell, notification centre, Feedback and Live status tabs of the [frontend](frontend/README.md).

```bash
cd notification-service && JWT_SECRET=<Team 1's secret> ./mvnw spring-boot:run      # needs MongoDB on localhost:27017
cd notification-service && ./mvnw test                                            # MongoDB database team6_test
```

The demo endpoints (fake journey, reset) are off; start with `TEAM6_DEMO=true`, and the frontend with `VITE_TEAM6_DEMO=true` to see their buttons.

---

## License

This project is licensed under the Apache License 2.0 — see the [LICENSE](LICENSE) file for details.