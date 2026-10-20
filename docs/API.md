# C1 Authentication API — Contract for Member 3 (Frontend)

> **Owner:** Member 1 — Identity & Access Backend
> **Base URL (development):** `http://localhost:3000`
> **Base URL (production):** TBD
> **API prefix:** `/api/auth`

---

## Table of Contents

1. [Setup & Quick Start](#1-setup--quick-start)
2. [Authentication Model](#2-authentication-model)
3. [Request / Response Conventions](#3-request--response-conventions)
4. [Endpoints](#4-endpoints)
   - [POST /api/auth/register](#41-post-apiauthregister)
   - [POST /api/auth/login](#42-post-apiauthlogin)
   - [GET /api/auth/me](#43-get-apiauthme)
   - [POST /api/auth/logout](#44-post-apiauthlogout)
   - [POST /api/auth/refresh](#45-post-apiauthrefresh)
   - [POST /api/auth/change-password](#46-post-apiauthchange-password)
   - [POST /api/auth/forgot-password](#47-post-apiauthforgot-password)
   - [POST /api/auth/reset-password](#48-post-apiauthreset-password)
5. [Protected Route Integration](#5-protected-route-integration)
6. [User Roles & Permissions](#6-user-roles--permissions)
7. [Error Reference](#7-error-reference)
8. [Development Test Accounts](#8-development-test-accounts)
9. [Running the Backend](#9-running-the-backend)
10. [Authenticated Identity Interface (for other backend teams)](#10-authenticated-identity-interface-for-other-backend-teams)

---

## 1. Setup & Quick Start

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | 18+ |
| PostgreSQL | 14+ |
| MongoDB | 6+ (for audit log) |

### Install & configure

```bash
# From the project root
cd backend
npm install

# Create your local environment file
cp .env.example .env
# Edit .env and set PGPASSWORD, JWT_SECRET, and MONGO_URI

# Set up the database (run once)
createdb railway
psql -d railway -v ON_ERROR_STOP=1 -f ../database/c1-identity/schema.sql
psql -d railway -v ON_ERROR_STOP=1 -f ../database/c1-identity/schema_auth_tokens.sql
psql -d railway -v ON_ERROR_STOP=1 -f ../database/c1-identity/seed.sql
psql -d railway -v ON_ERROR_STOP=1 -f ../database/c1-identity/seed_dev_users.sql

# Start in development mode
npm run dev
```

The server will start on `http://localhost:3000` (or the `PORT` in your `.env`).

### Health check

```
GET /health
→ 200 { "status": "ok", "timestamp": "..." }
```

---

## 2. Authentication Model

The system uses **two-token authentication**:

| Token | Type | Lifetime | Where stored |
|---|---|---|---|
| **Access token** | JWT (signed HS256) | 15 minutes (configurable) | Memory / `Authorization` header |
| **Refresh token** | Opaque random hex | 7 days (configurable) | Secure HTTP-only cookie or local storage |

**Flow:**
1. Call `/api/auth/login` → receive both tokens.
2. Include the **access token** as `Authorization: Bearer <token>` on every protected request.
3. When the access token expires (HTTP 401 `TOKEN_EXPIRED`), call `/api/auth/refresh` with the refresh token to get a new pair.
4. On logout, call `/api/auth/logout` — this revokes the refresh token server-side.

> **Important:** After logout, the access token remains technically valid until it expires naturally (up to 15 min). **Always discard both tokens from client storage on logout.** The server revokes the refresh token immediately.

---

## 3. Request / Response Conventions

- All request bodies are **JSON** (`Content-Type: application/json`).
- All responses are **JSON**.
- HTTP status codes follow REST conventions (see [Error Reference](#7-error-reference)).

### Standard error shape

```json
{
  "error": {
    "code":    "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```

For validation errors, a `fields` array is also included:

```json
{
  "error": {
    "code":    "VALIDATION_ERROR",
    "message": "Request validation failed",
    "fields": [
      { "field": "email",    "message": "email must be a valid email address" },
      { "field": "password", "message": "password must be at least 8 characters..." }
    ]
  }
}
```

---

## 4. Endpoints

### 4.1 POST /api/auth/register

**Purpose:** Create a new customer account.
**Authentication:** None required.
**Rate limited:** Yes (20 requests / 15 minutes per IP).

#### Request body

| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | string | ✅ | 1–100 characters, non-blank |
| `email` | string | ✅ | Valid email format |
| `phone` | string | ❌ | 10–15 digits, optional leading `+` |
| `password` | string | ✅ | Min 8 chars; must contain uppercase, lowercase, digit, special char |

```json
{
  "name":     "Priya Sharma",
  "email":    "priya@example.com",
  "phone":    "+919876543210",
  "password": "Railway@Secure1!"
}
```

#### Response — 201 Created

```json
{
  "message": "Account created successfully",
  "user": {
    "userId": 42,
    "name":   "Priya Sharma",
    "email":  "priya@example.com",
    "role":   "CUSTOMER",
    "status": "ACTIVE"
  }
}
```

#### Error responses

| Status | Code | Condition |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing or invalid fields |
| 409 | `EMAIL_TAKEN` | Email already registered |
| 500 | `SERVER_ERROR` | Unexpected server error |

> **Note:** The `role` is always `CUSTOMER` for public registration. Any `role` field in the request is silently ignored.

---

### 4.2 POST /api/auth/login

**Purpose:** Authenticate with email and password.
**Authentication:** None required.
**Rate limited:** Yes (20 requests / 15 minutes per IP).

#### Request body

```json
{
  "email":    "priya@example.com",
  "password": "Railway@Secure1!"
}
```

#### Response — 200 OK

```json
{
  "message":      "Login successful",
  "token":        "<access-token>",
  "refreshToken": "<refresh-token>",
  "user": {
    "userId": 42,
    "name":   "Priya Sharma",
    "email":  "priya@example.com",
    "role":   "CUSTOMER"
  }
}
```

#### Error responses

| Status | Code | Condition |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing fields |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password (generic — does not reveal which) |
| 403 | `ACCOUNT_NOT_ACTIVE` | Account is LOCKED, SUSPENDED, INACTIVE, or PENDING |
| 500 | `SERVER_ERROR` | Unexpected server error |

> **Account lockout:** After 5 consecutive wrong passwords, the account is `LOCKED`. Further logins return 403 until an admin unlocks the account.

> **Status messages (403):** The `error.message` field will contain a user-friendly explanation of why the account cannot log in (e.g., "Your account has been locked...").

---

### 4.3 GET /api/auth/me

**Purpose:** Return the current authenticated user's profile.
**Authentication:** Required — `Authorization: Bearer <access-token>`.

#### Response — 200 OK

```json
{
  "userId":      42,
  "name":        "Priya Sharma",
  "email":       "priya@example.com",
  "phone":       "+919876543210",
  "role":        "CUSTOMER",
  "status":      "ACTIVE",
  "createdAt":   "2026-01-15T10:30:00.000Z",
  "lastLoginAt": "2026-10-17T09:00:00.000Z"
}
```

#### Error responses

| Status | Code | Condition |
|---|---|---|
| 401 | `MISSING_TOKEN` | No `Authorization` header |
| 401 | `INVALID_TOKEN` | Token is malformed or signature invalid |
| 401 | `TOKEN_EXPIRED` | Access token has expired — call `/api/auth/refresh` |
| 401 | `ACCOUNT_NOT_ACTIVE` | Account was deactivated since last login |

---

### 4.4 POST /api/auth/logout

**Purpose:** Revoke the user's refresh tokens and end the session.
**Authentication:** Required — `Authorization: Bearer <access-token>`.

#### Request body

No body required.

#### Response — 200 OK

```json
{ "message": "Logged out successfully" }
```

> **Important:** The access token remains valid until it expires (up to 15 min). Always delete both tokens from client storage immediately on receiving this response.

#### Error responses

| Status | Code | Condition |
|---|---|---|
| 401 | `MISSING_TOKEN` | No `Authorization` header |
| 401 | `INVALID_TOKEN` | Token invalid |

---

### 4.5 POST /api/auth/refresh

**Purpose:** Exchange a refresh token for a new access token + refresh token pair.
**Authentication:** None (the refresh token itself is the credential).

#### Request body

```json
{ "refreshToken": "<refresh-token>" }
```

#### Response — 200 OK

```json
{
  "token":        "<new-access-token>",
  "refreshToken": "<new-refresh-token>"
}
```

> **Rotation:** Each call issues a **new** refresh token and invalidates the old one. Store the new refresh token and discard the old.

#### Error responses

| Status | Code | Condition |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `refreshToken` field missing |
| 401 | `INVALID_REFRESH_TOKEN` | Token not found, already revoked |
| 401 | `EXPIRED_REFRESH_TOKEN` | Refresh token has expired (re-login required) |

---

### 4.6 POST /api/auth/change-password

**Purpose:** Change the password for the currently authenticated user.
**Authentication:** Required — `Authorization: Bearer <access-token>`.

#### Request body

```json
{
  "currentPassword": "Railway@Secure1!",
  "newPassword":     "NewRailway@Pass2!"
}
```

#### Response — 200 OK

```json
{ "message": "Password changed successfully" }
```

> **Side effect:** All refresh tokens for the user are revoked. The client must re-login on all devices.

#### Error responses

| Status | Code | Condition |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing fields or weak new password |
| 401 | `MISSING_TOKEN` / `INVALID_TOKEN` | Not authenticated |
| 401 | `INVALID_CREDENTIALS` | `currentPassword` is wrong |

---

### 4.7 POST /api/auth/forgot-password

**Purpose:** Initiate a password reset flow.
**Authentication:** None.
**Rate limited:** Yes.

> **Email delivery not yet implemented.** In development mode, the reset token is returned in the response body as `devToken`. In production, the token would be emailed to the user. This must be integrated with an email service (e.g., SendGrid) before going live.

#### Request body

```json
{ "email": "priya@example.com" }
```

#### Response — 200 OK (always, to prevent email enumeration)

**In development mode:**
```json
{
  "message":  "If that email address is registered, a password reset link has been sent.",
  "devToken": "a3f2...hex-token...",
  "devNote":  "DEV MODE: devToken returned in response. Remove in production."
}
```

**In production mode (or unknown email):**
```json
{
  "message": "If that email address is registered, a password reset link has been sent."
}
```

---

### 4.8 POST /api/auth/reset-password

**Purpose:** Set a new password using the token from the reset email.
**Authentication:** None.

#### Request body

```json
{
  "token":       "<token-from-email-or-devToken>",
  "newPassword": "BrandNew@Pass9!"
}
```

#### Response — 200 OK

```json
{ "message": "Password reset successfully. Please log in." }
```

> **Side effect:** All refresh tokens for the user are revoked. Single-use: the token cannot be reused.

#### Error responses

| Status | Code | Condition |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing fields or weak new password |
| 400 | `INVALID_RESET_TOKEN` | Token not found, already used, or expired (1 hour TTL) |

---

## 5. Protected Route Integration

### Attaching a Bearer token

Every request to a protected endpoint must include:

```
Authorization: Bearer <access-token>
```

### JavaScript / fetch example

```javascript
async function getMyProfile(accessToken) {
  const response = await fetch('http://localhost:3000/api/auth/me', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type':  'application/json',
    },
  });

  if (response.status === 401) {
    const err = await response.json();
    if (err.error.code === 'TOKEN_EXPIRED') {
      // Refresh the token and retry
      const newTokens = await refreshTokens(storedRefreshToken);
      // retry original request with newTokens.token
    }
  }

  return response.json();
}

async function refreshTokens(refreshToken) {
  const res = await fetch('http://localhost:3000/api/auth/refresh', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ refreshToken }),
  });
  if (!res.ok) throw new Error('Session expired. Please log in again.');
  const data = await res.json();
  // Save data.token (new access token) and data.refreshToken (new refresh token)
  return data;
}
```

### Token storage recommendation

| Storage | Pros | Cons |
|---|---|---|
| `localStorage` | Simple | Vulnerable to XSS |
| `sessionStorage` | Cleared on tab close | Vulnerable to XSS |
| HTTP-only cookie | XSS-safe | Requires CSRF protection |

For this project (college/development), `localStorage` or `sessionStorage` is acceptable. For production, prefer HTTP-only cookies for the refresh token.

---

## 6. User Roles & Permissions

### Roles

| Role | Description |
|---|---|
| `CUSTOMER` | Self-service passenger — books their own tickets |
| `STAFF` | Railway employee — can view passenger details |
| `ADMIN` | System administrator — manages users, staff, roles, master data |

### Permission matrix

| Permission | CUSTOMER | STAFF | ADMIN |
|---|:-:|:-:|:-:|
| `BOOK_TICKET` | ✔ | | |
| `VIEW_OWN_BOOKING` | ✔ | | |
| `CANCEL_OWN_BOOKING` | ✔ | | |
| `VIEW_PASSENGER` | | ✔ | ✔ |
| `MANAGE_USERS` | | | ✔ |
| `MANAGE_STAFF` | | | ✔ |
| `MANAGE_ROLES` | | | ✔ |
| `MANAGE_MASTER_DATA` | | | ✔ |
| `VIEW_AUDIT_LOG` | | | ✔ |

### Checking the current user's role in the frontend

The `/api/auth/me` response includes `role`. Use this to show/hide UI elements.
**Never rely solely on the frontend role for access control** — the backend always enforces permissions server-side.

---

## 7. Error Reference

| HTTP Status | Code | Meaning |
|---|---|---|
| 200 | — | Success |
| 201 | — | Created (registration) |
| 400 | `VALIDATION_ERROR` | Invalid or missing request fields |
| 400 | `INVALID_RESET_TOKEN` | Reset token invalid or expired |
| 401 | `MISSING_TOKEN` | No Authorization header |
| 401 | `INVALID_TOKEN` | JWT signature invalid or malformed |
| 401 | `TOKEN_EXPIRED` | Access token expired — refresh it |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password |
| 401 | `INVALID_REFRESH_TOKEN` | Refresh token invalid or revoked |
| 401 | `EXPIRED_REFRESH_TOKEN` | Refresh token expired — re-login required |
| 403 | `ACCOUNT_NOT_ACTIVE` | Account LOCKED / SUSPENDED / INACTIVE / PENDING |
| 403 | `FORBIDDEN` | Authenticated but lacks required role/permission |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `EMAIL_TAKEN` | Registration email already in use |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `SERVER_ERROR` | Unexpected server error |

---

## 8. Development Test Accounts

All use password: **`Railway@Dev123`**

| Email | Role | Status | Purpose |
|---|---|---|---|
| `customer@example.com` | CUSTOMER | ACTIVE | Normal login, booking |
| `staff@example.com` | STAFF | ACTIVE | Staff operations |
| `admin@example.com` | ADMIN | ACTIVE | Admin operations |
| `locked@example.com` | CUSTOMER | LOCKED | Test locked-account rejection |
| `suspended@example.com` | CUSTOMER | SUSPENDED | Test suspended-account rejection |

### Quick login example

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"customer@example.com","password":"Railway@Dev123"}' | jq
```

---

## 9. Running the Backend

### Development server

```bash
cd backend
npm run dev     # Uses nodemon — auto-reloads on file changes
```

### Production

```bash
npm start
```

### Running tests

```bash
# Set up the test database first (once):
createdb railway_test
psql -d railway_test -v ON_ERROR_STOP=1 -f ../database/c1-identity/schema.sql
psql -d railway_test -v ON_ERROR_STOP=1 -f ../database/c1-identity/schema_auth_tokens.sql
psql -d railway_test -v ON_ERROR_STOP=1 -f ../database/c1-identity/seed.sql
psql -d railway_test -v ON_ERROR_STOP=1 -f ../database/c1-identity/seed_dev_users.sql

# Run the authentication tests:
npm test

# Run with coverage:
npm run test:coverage
```

Also run Member 2's database tests (separate from this backend):

```bash
cd database/c1-identity
PGHOST=localhost PGUSER=postgres ./tests/run_tests.sh
```

---

## 10. Authenticated Identity Interface (for other backend teams)

Other backend modules (C2 trains, C4 booking, C5 payments) should use the shared authentication middleware to protect their routes.

### Import the middleware

```javascript
const { authenticate }      = require('../middleware/authenticate');
const { requireRole,
        requirePermission,
        requireOwnership }  = require('../middleware/authorize');
```

### Use in your routes

```javascript
// Authenticated users only
router.get('/my-bookings', authenticate, (req, res) => {
  const userId = req.user.userId; // integer — from DB, not from token
  const role   = req.user.role;   // e.g. 'CUSTOMER'
  // ...
});

// Only users with a specific role
router.delete('/trains/:id', authenticate, requireRole('ADMIN'), handler);

// Only users with a specific permission
router.get('/passengers', authenticate, requirePermission('VIEW_PASSENGER'), handler);

// Only the resource owner (or ADMIN)
router.get('/users/:userId/bookings', authenticate, requireOwnership('userId'), handler);
```

### The `req.user` object

After `authenticate()` runs, `req.user` is always:

```typescript
{
  userId: number;  // users.user_id — integer, from DB
  role:   string;  // 'CUSTOMER' | 'STAFF' | 'ADMIN' — from DB, not token
}
```

> **Never use** `req.body.userId` or `req.query.userId` as proof of identity. Always use `req.user.userId`.

### Response conventions

| Scenario | HTTP status | Code |
|---|---|---|
| Not authenticated | 401 | `MISSING_TOKEN` / `INVALID_TOKEN` / `TOKEN_EXPIRED` |
| Authenticated but lacks role/permission | 403 | `FORBIDDEN` |

---

## Limitations & Known Issues

| Feature | Status | Notes |
|---|---|---|
| Email delivery (forgot-password) | ⚠️ Not implemented | `devToken` returned in dev mode only |
| Temporary account lockout | ⚠️ Permanent until admin reset | Schema has no `locked_until` column (open decision #4 in DB README) |
| Token tables in master schema | ⚠️ Proposed only | `refresh_tokens` and `password_reset_tokens` need team sign-off before DBML inclusion |
| HTTPS | ❌ Not configured | Use a reverse proxy (nginx/Caddy) with TLS in production |
| Email verification flow | ❌ Not implemented | Schema supports `PENDING` status but no verification endpoint exists yet |
