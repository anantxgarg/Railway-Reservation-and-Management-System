# Railway Reservation & Management System

Full-stack Railway Reservation & Management System featuring ticket booking, PNR generation, seat inventory, payments, live train status, notifications, analytics, and role-based access control (RBAC).

---

## Architecture & Team Modules

| Team | Module | Responsibility | Tech Stack | Status |
|---|---|---|---|---|
| **Team 1** | Users & Auth | Authentication, JWT & refresh tokens, RBAC, password reset, audit logging, identity database | Node.js, Express, PostgreSQL, MongoDB, Brevo API | Backend & database implemented; frontend pending |
| **Team 2** | Trains, Stations, Routes | Master train catalog, stations, routes, schedules, coaches, seat layouts | TBD | Not started |
| **Team 3** | Booking, PNR, Seats | Booking management, PNR generation, seat allocation, waitlist | PostgreSQL, Spring Boot | Database and API implemented & tested; frontend pending |
| **Team 4** | Payments & Refunds | Razorpay payment gateway integration, concession calculations, refund policies | Spring Boot, Razorpay, React + MUI | Implemented |
| **Team 5** | Reports & Analytics | Reports, analytics, admin dashboards | TBD | Not started |
| **Team 6** | Notifications, Status, Feedback | Email / SMS notifications, live train status, feedback | TBD | Not started |

---

## Shared Database Setup

All teams share one PostgreSQL database, `railway`. `database/setup.sh` builds it from each team's SQL in dependency order (C1 identity, then C3 booking):

```bash
PGHOST=localhost PGUSER=postgres ./database/setup.sh            # create and fill "railway"
PGHOST=localhost PGUSER=postgres ./database/setup.sh --reset    # drop and rebuild it
```

Start Team 4's Spring Boot app afterwards; it creates its own tables on startup.

### Running the services together

| Service | Folder | Port | Start |
|---|---|---|---|
| Users & Auth (Team 1) | `backend/` | 3000 | `npm start` (needs `.env`, see Team 1) |
| Booking (Team 3) | `booking-service/` | 8082 | `./mvnw spring-boot:run` |
| Payments (Team 4) | repo root | 8081 | `mvn spring-boot:run` (needs Razorpay test keys) |

All three use the same `PG*` variables for the database. They must also share **one `JWT_SECRET`**: Team 1 signs logins with it, and the other two verify the tokens with it.

---

## Team 1 — Users & Auth

The authentication backend provides secure user identity management, credential hashing, session tokens, account lockout protection, and transactional email password resets.

Detailed API specifications, request/response schemas, and error codes are documented in [`docs/API.md`](docs/API.md).
Database schemas and role-permission matrices are documented in [`database/c1-identity/README.md`](database/c1-identity/README.md).

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

   Run the database scripts in order against the `railway` database:

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

## Team 3 — Booking, PNR & Seats

Search, availability, booking, PNR status and cancellation, with seat allocation, RAC and waitlist.
- **Database:** [`database/c3-booking/`](database/c3-booking/README.md) holds the tables, triggers, procedures and views where the booking rules live. It also has placeholder copies of the network tables (Team 2) and `concession_rule` (Team 4) until those teams take them over.
- **API:** [`booking-service/`](booking-service/README.md), Spring Boot on port 8082. It accepts Team 1's login tokens, so it needs the same `JWT_SECRET`.

```bash
PGHOST=localhost PGUSER=postgres ./database/setup.sh                      # shared database
cd booking-service && PGHOST=localhost PGUSER=postgres JWT_SECRET=<Team 1's secret> ./mvnw spring-boot:run
```

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
   mvn spring-boot:run
   ```
   The API is on port 8081. Set `PAYMENTS_PORT` to change it.

Flyway creates this app's tables (`V1`, `V2`). It baselines at version 0, so it also works on the shared database where other teams' tables already exist. Hibernate only validates the schema (`ddl-auto=validate`).

Logins are Team 1's. Every endpoint except the webhook and the concession preview needs `Authorization: Bearer <token>` from Team 1's `POST /api/auth/login`. The app's old development login (`/api/auth/login` on this port) has been removed.

**The frontend is not updated yet.** The React app (`frontend/`) and `src/main/resources/static/` still call the removed booking and login endpoints. Team 3's booking screens and the PNR-based payment step replace them next.

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
| POST | `/api/concessions/apply` | CUSTOMER, ADMIN | `{ "pnr", "passengerId", "category", "idCardType", "idCardNumber" }` |
| GET | `/api/concessions/pending`, POST `/api/concessions/{id}/review` | STAFF, ADMIN | Verify concession documents |
| GET | `/api/concessions/booking/{pnr}` | owner, STAFF, ADMIN | Applications for a booking |

### Tests

```bash
PGHOST=localhost PGUSER=postgres PGDATABASE=railway_test ./database/setup.sh --reset
PGHOST=localhost PGUSER=postgres mvn test
```

The unit tests need no database. The integration tests (`web/*Test`) run against `railway_test`, with Razorpay replaced by a mock, so no real payments are made. They cover:
- order, verify and webhook;
- late, outdated and duplicate payments;
- partial and full refunds, and a refused refund rolling the cancellation back;
- concessions and logins.

### Concession rules (`application.properties`)

Percent off base fare: GENERAL 0, SENIOR_CITIZEN 40, STUDENT 25, CHILD 50, DIFFERENTLY_ABLED 50, ARMED_FORCES 30. These are placeholder numbers; change them to whatever the group agrees on.

### Refund policy (`application.properties`)

Refund is a percentage of the **amount actually paid** (after concession):

| Time before departure | Refund |
|---|---|
| 48h or more | 90% |
| 24h to 48h | 75% |
| 4h to 24h | 50% |
| under 4h | no refund (cancelling is still allowed and frees the seats) |

The refund is worked out on what was paid for the passengers being cancelled. The schema has no departure time yet (Team 2), so departure is taken as the start of the travel day in India (00:00 IST). That never gives more refund than the policy allows.

### Webhook setup (optional for local testing)

1. Expose your app: `ngrok http 8081`.
2. Dashboard → Webhooks → Add: URL `https://<ngrok>/api/payments/webhook`, secret = `RAZORPAY_WEBHOOK_SECRET`.
3. Enable events: `payment.captured`, `payment.failed`, `refund.processed`, `refund.failed`.

### Testing in test mode

- Card: `4111 1111 1111 1111`, any future expiry, any CVV, any OTP.
- UPI: `success@razorpay` (success) or `failure@razorpay` (failure).
- Make sure payments are set to **auto-capture** in Dashboard → Settings → Configuration → Payment Capture, otherwise they stay "authorized" and refunds will fail.

### Things to revisit

- **Concessions have two sources of truth:**
  - Team 3's `concession_rule` table, applied per passenger at booking, which changes the fare paid;
  - this app's `concession.*` percentages and staff-verified applications, which don't change the fare yet.

  Agree on one, then remove the other.
- **Departure time for the refund windows** (see Refund policy).
- **Waitlisted passengers when the chart is prepared.** If they still have no berth, they should be refunded in full automatically.
- **A reconciliation job** for orders stuck in `CREATED`.
- **Error format.** This app answers `{"error": "message"}`, while Team 1 and Team 3 answer `{"error": {"code", "message"}}`.

---

## License

This project is licensed under the Apache License 2.0 — see the [LICENSE](LICENSE) file for details.