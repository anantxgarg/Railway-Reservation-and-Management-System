# Railway Reservation & Management System

Full-stack Railway Reservation & Management System featuring ticket booking, PNR generation, seat inventory, payments, live train status, notifications, analytics, and role-based access control (RBAC).

---

## Architecture & Team Modules

| Team | Module | Responsibility | Tech Stack | Status |
|---|---|---|---|---|
| **Team 1** | Users & Auth | Authentication, JWT & refresh tokens, RBAC, password reset, audit logging, identity database | Node.js, Express, PostgreSQL, MongoDB, Brevo API | Backend & database implemented; frontend pending |
| **Team 2** | Trains, Stations, Routes | Master train catalog, stations, routes, schedules, coaches, seat layouts | TBD | Not started |
| **Team 3** | Booking, PNR, Seats | Booking management, PNR generation, seat allocation, waitlist | PostgreSQL; Spring Boot (planned) | Database in progress |
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

Database for bookings, passengers and seat allocation, in [`database/c3-booking/`](database/c3-booking/README.md). It also holds placeholder copies of the network tables (Team 2) and `concession_rule` (Team 4) until those teams take them over.

Run the database tests (builds and drops its own `railway_c3_test` database):

```bash
PGHOST=localhost PGUSER=postgres ./database/c3-booking/tests/run_tests.sh
```

---

## Team 4 — Payments & Refunds (Razorpay Payment Gateway)

Spring Boot 3 / Java 17 prototype covering **payments, refunds and passenger concessions** for a ticket booking system. The booking module here is only a stand-in; swap it for the group's real one later.

### Run

1. Get **test mode** keys: Razorpay Dashboard → Account & Settings → API Keys.
2. Set env vars (or edit `application.properties`):
   ```bash
   export RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
   export RAZORPAY_KEY_SECRET=xxxxxxxx
   export RAZORPAY_WEBHOOK_SECRET=any_string_you_choose
   mvn spring-boot:run
   ```
3. Open http://localhost:8080 for the web UI (use the port you set in `server.port`; 8081 if 8080 is taken).

### Frontend

Plain HTML, CSS and JavaScript in `src/main/resources/static/`, served by Spring Boot on the same port as the API, so there is no build step and no CORS setup.

| File | Purpose |
|---|---|
| `index.html` | Two views: **Book a ticket** and **Manage booking** (hash routes `#/book`, `#/manage/{id}`) |
| `css/style.css` | All styling, with light and dark themes |
| `js/app.js` | Form validation, live fare, Razorpay Checkout, payment verification, refund flow |

Changes are picked up by refreshing the browser. If you use IntelliJ, rebuild or restart so `static/` is copied to `target/classes`.

Before going live: delete the "Testing with Razorpay test mode?" block in `index.html`.

Default DB is in-memory H2 (zero setup). MySQL config is commented in `application.properties`.

### Flow

```
POST /api/bookings            -> concession applied, status PENDING_PAYMENT
POST /api/payments/order      -> Razorpay order for finalAmount
   (browser: Razorpay Checkout)
POST /api/payments/verify     -> signature check, status CONFIRMED
POST /api/payments/webhook    -> same result via Razorpay callback (safety net)
GET  /api/refunds/preview/{bookingId}
POST /api/refunds             -> cancels booking, refunds per policy
```

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/concessions/preview?category=STUDENT&baseFare=500` | Fare after concession |
| POST | `/api/bookings` | Create booking |
| GET | `/api/bookings/{id}` | Booking details/status |
| POST | `/api/payments/order` | `{ "bookingId": 1 }` |
| POST | `/api/payments/verify` | `{ razorpayOrderId, razorpayPaymentId, razorpaySignature }` |
| POST | `/api/payments/webhook` | Razorpay callback |
| GET | `/api/payments/booking/{id}` | Payments for a booking |
| GET | `/api/refunds/preview/{bookingId}` | What a cancellation would refund |
| POST | `/api/refunds` | `{ "bookingId": 1, "reason": "..." }` |
| GET | `/api/refunds/booking/{id}` | Refunds for a booking |

Example booking:
```json
{
  "passengerName": "Asha", "email": "asha@example.com", "phone": "9999999999",
  "origin": "Pune", "destination": "Mumbai",
  "departureTime": "2026-10-20T18:30:00",
  "category": "STUDENT", "baseFare": 500
}
```

### Concession rules (`application.properties`)

Percent off base fare: GENERAL 0, SENIOR_CITIZEN 40, STUDENT 25, CHILD 50, DIFFERENTLY_ABLED 50, ARMED_FORCES 30. These are placeholder numbers; change them to whatever the group agrees on.

### Refund policy (`application.properties`)

Refund is a percentage of the **amount actually paid** (after concession):

| Time before departure | Refund |
|---|---|
| 48h or more | 90% |
| 24h to 48h | 75% |
| 4h to 24h | 50% |
| under 4h | not refundable |

### Webhook setup (optional for local testing)

1. Expose your app: `ngrok http 8080`.
2. Dashboard → Webhooks → Add: URL `https://<ngrok>/api/payments/webhook`, secret = `RAZORPAY_WEBHOOK_SECRET`.
3. Enable events: `payment.captured`, `payment.failed`, `refund.processed`, `refund.failed`.

### Testing in test mode

- Card: `4111 1111 1111 1111`, any future expiry, any CVV, any OTP.
- UPI: `success@razorpay` (success) or `failure@razorpay` (failure).
- Make sure payments are set to **auto-capture** in Dashboard → Settings → Configuration → Payment Capture, otherwise they stay "authorized" and refunds will fail.

### Things to revisit once the full system is defined

- Replace `Booking` with the real booking/seat module (keep `bookingId` as the link).
- Move concession and refund rules to a DB table or admin config.
- Add authentication; today anyone can call the refund endpoint.
- Partial cancellations (multi-passenger tickets), GST/convenience fee handling.
- Reconciliation job for orders stuck in `CREATED`.

---

## License

This project is licensed under the Apache License 2.0 — see the [LICENSE](LICENSE) file for details.