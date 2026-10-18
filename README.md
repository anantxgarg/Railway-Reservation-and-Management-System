# Railway Reservation & Management System

Full-stack Railway Reservation & Management System featuring ticket booking, PNR generation, seat inventory, payments, live train status, notifications, analytics, and role-based access control (RBAC).

---

## Architecture & Team Modules

| Module | Component | Responsibility | Tech Stack | Status |
|---|---|---|---|---|
| **C1** | **Identity & Access Backend** | Authentication, JWT & Refresh tokens, RBAC, password reset, audit logging | Node.js, Express, PostgreSQL, MongoDB, Brevo API | **Implemented & Tested** |
| **C1** | **Identity Database** | Relational schema, tokens, dev seed users, role-permission matrix | PostgreSQL 14+, MongoDB 6+ | Implemented |
| **C2** | Trains & Routes | Master train catalog, stations, scheduling, seat layouts | Spring Boot / Java | In Progress |
| **C3** | Booking & PNR | Booking management, waitlist, PNR generation | TBD | In Progress |
| **C4** | Payments & Refunds | Razorpay payment gateway integration, concession calculations, refund policies | Spring Boot, Razorpay | In Progress |
| **C5** | Notifications & Alerts | Email / SMS notifications, live train status updates | TBD | In Progress |

---

## Member 1 — Identity & Access / Authentication Backend

The authentication backend provides secure user identity management, credential hashing, session tokens, account lockout protection, and transactional email password resets.

Detailed API specifications, request/response schemas, and error codes are documented in [`docs/API.md`](docs/API.md).
Database schemas and role-permission matrices are documented in [`database/c1-identity/README.md`](database/c1-identity/README.md).

### Prerequisites

- **Node.js**: `v18.0.0` or higher (`v20+` recommended)
- **PostgreSQL**: `14+` (running locally or accessible over network, port `5432`)
- **MongoDB**: `6+` (for audit logging, port `27017`)

---

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

---

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

---

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

---

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

---

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

### License

This project is licensed under the Apache License 2.0 — see the [LICENSE](LICENSE) file for details.
