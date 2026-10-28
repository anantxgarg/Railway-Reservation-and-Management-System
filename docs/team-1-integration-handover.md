# Team 1 (Identity & Access) — Integration Handover Document

**Module**: C1 — Identity, Authentication & Role-Based Access Control  
**Branch**: `team-1`  
**Repository**: `anantxgarg/Railway-Reservation-and-Management-System`  
**Date**: October 2026  
**Status**: Completed, Verified & Integration-Ready

---

## 1. Executive Summary & Contribution Scope

This document establishes the official integration handover for Team 1 (C1 Identity & Access). It delineates the preexisting database and backend work provided by teammates, the new React + Vite frontend application contributed for this milestone, and specific local testing/configuration adjustments.

### High-Level Breakdown
- **Teammates' Preexisting Deliverables (Preserved Baseline)**:
  - PostgreSQL schema (`users`, `roles`, `permissions`, `role_permissions`, `audit_log`, `password_reset_tokens`, `refresh_tokens`).
  - Express.js Authentication API (`/api/auth/*`, `/api/admin/*`, `/api/users/*`).
  - Comprehensive API specification ([`docs/API.md`](API.md)).
  - Seeded test accounts and role-permission matrices.
- **My Primary Contribution (New Frontend Module)**:
  - Complete React + Vite single-page application under [`frontend/`](../frontend/).
  - **Safar** brand identity (*“Let every journey take you somewhere wonderful.”*).
  - Full authentication lifecycle integration (Register, Login, Session Management, Logout, Password Reset, Change Password).
  - Role-Based Access Control (RBAC) with `ProtectedRoute` and dedicated portals for `CUSTOMER`, `STAFF`, and `ADMIN`.
  - Dual-theme engine (Dark Mode & Light Mode) with persistent theme storage and fixed full-viewport backgrounds.
- **Local Integration Adjustments**:
  - Aligned password-reset email URL generation with the active frontend development port (`5174`).
  - Made backend unit tests dynamically evaluate the configured frontend base URL.
  - Added test timeout helpers to prevent Jest runner timeout flakes.
  - Created development configuration templates ([`frontend/.env.example`](../frontend/.env.example)) and setup documentation ([`frontend/README.md`](../frontend/README.md)).

---

## 2. Section A: Existing Database & Backend Baseline (Teammates' Work)

The core database schemas and backend services were authored by teammates (commit `a670865` by Tisha). This implementation is fully preserved:

1. **Database Scripts ([`database/c1-identity/`](../database/c1-identity/))**:
   - `schema.sql`: Users, roles, permissions, audit logging, and the `user_permissions` view.
   - `schema_auth_tokens.sql`: Secure token storage with SHA-256 hashing for refresh and password-reset tokens.
   - `seed.sql`: Canonical role-permission definitions (`CUSTOMER`, `STAFF`, `ADMIN`).
   - `seed_dev_users.sql`: Five pre-seeded development accounts (`customer@example.com`, `staff@example.com`, `admin@example.com`, `locked@example.com`, `suspended@example.com`).
2. **Backend Authentication API ([`backend/src/`](../backend/src/))**:
   - Standard Express application listening on port `3000`.
   - Argon2/bcrypt password hashing (cost factor 12) with timing-attack prevention.
   - HS256 JWT access tokens (15-minute lifespan) + cryptographic refresh token rotation.
   - Role and permission middleware (`requireRole`, `requirePermission`) evaluating database permissions in real time.
   - Account lockout security (locks after consecutive failed attempts).
   - Brevo Transactional Email delivery service for self-service password reset.
3. **Contract Documentation ([`docs/API.md`](API.md))**:
   - Exhaustive endpoint catalog, status codes, and error envelopes.

---

## 3. Section B: New Frontend Implementation (`frontend/`)

The frontend is an entirely new standalone application located in [`frontend/`](../frontend/).

### Key Capabilities & Architecture

| Component / Layer | Path | Responsibility |
|---|---|---|
| **API Client** | [`frontend/src/services/api.js`](../frontend/src/services/api.js) | Base HTTP fetch wrapper with automatic JWT injection, reverse-proxy routing, and 401 token refresh retry. |
| **Auth Service** | [`frontend/src/services/authService.js`](../frontend/src/services/authService.js) | High-level API calls: `login`, `register`, `logout`, `requestPasswordReset`, `resetPassword`, `changePassword`, `getProfile`. |
| **Token Storage** | [`frontend/src/utils/tokenStorage.js`](../frontend/src/utils/tokenStorage.js) | Secure client-side storage for access and refresh tokens in `localStorage`. |
| **Auth Context** | [`frontend/src/context/AuthContext.jsx`](../frontend/src/context/AuthContext.jsx) | Global state managing active user identity, token refresh loops, and session initialization. |
| **RBAC Route Guard** | [`frontend/src/components/ProtectedRoute.jsx`](../frontend/src/components/ProtectedRoute.jsx) | Guards routes by role. Blocks unauthorized roles and redirects to `/unauthorized`. |
| **Role Routing** | [`frontend/src/utils/roleUtils.js`](../frontend/src/utils/roleUtils.js) | Maps `CUSTOMER` $\rightarrow$ `/customer`, `STAFF` $\rightarrow$ `/staff`, `ADMIN` $\rightarrow$ `/admin`. |
| **Theme Engine** | [`frontend/src/context/ThemeContext.jsx`](../frontend/src/context/ThemeContext.jsx) | Handles dynamic Dark/Light mode toggling, applying dataset attributes and persistent preference. |
| **Auth Layout & UI** | [`frontend/src/components/AuthLayout.jsx`](../frontend/src/components/AuthLayout.jsx) | Shared hero layout featuring Safar branding, responsive glassmorphic cards, and solid accessible navbars. |
| **Customer Portal** | [`frontend/src/pages/destinations/CustomerPortal.jsx`](../frontend/src/pages/destinations/CustomerPortal.jsx) | Quick-access actions (Find Trains, PNR Status, Bookings) and profile summary. |
| **Staff Portal** | [`frontend/src/pages/destinations/StaffPortal.jsx`](../frontend/src/pages/destinations/StaffPortal.jsx) | Operational hub for reservations, passenger lookups, and schedule inspection. |
| **Admin Portal** | [`frontend/src/pages/destinations/AdminPortal.jsx`](../frontend/src/pages/destinations/AdminPortal.jsx) | Security administration console with user management and account unlock capabilities. |
| **Unauthorized View** | [`frontend/src/pages/UnauthorizedPage.jsx`](../frontend/src/pages/UnauthorizedPage.jsx) | 403 Security Enforcement page with current role display and return-to-portal navigation. |

---

## 4. Section C: Additional Local Changes Outside `frontend/`

During local integration and testing, the following files outside `frontend/` were modified or added:

1. **`backend/tests/unit/emailDelivery.test.js` (Tracked / Modified)**:
   - *Change*: Updated assertions in `buildResetUrl` and `sendPasswordResetEmail` to evaluate `(config.frontendUrl || config.corsOrigin || 'http://localhost:5173')` dynamically instead of asserting a hardcoded `http://localhost:5173`.
   - *Reason*: When the frontend runs on port `5174` (due to Vite's automatic port fallback), `FRONTEND_URL` in `.env` is set to `http://localhost:5174`. Hardcoding `5173` caused unit test assertions to fail despite correct runtime behavior.
   - *Recommendation*: **Include in commit**. Makes test suite robust across all teammate developer environments.

2. **`backend/jest.config.js` (Tracked / Modified)**:
   - *Change*: Configured `setupFilesAfterEnv` referencing helper scripts for explicit timeout management.
   - *Reason*: Avoids Jest project-runner warnings regarding timeout options in multi-project mode.
   - *Recommendation*: **Include in commit** along with helper scripts, or keep existing timeouts if teammates prefer standard Jest configs.

3. **`backend/tests/helpers/unitTimeout.js` & `backend/tests/helpers/dbTimeout.js` (Untracked / New)**:
   - *Change*: Sets `jest.setTimeout(30000)` and `jest.setTimeout(60000)`.
   - *Reason*: Prevents slow database connection timeouts during integration test execution.
   - *Recommendation*: **Include in commit** if `backend/jest.config.js` is committed.

4. **`backend/tests/auth.test.js` (Tracked / Modified)**:
   - *Change*: Added `const { assertDisposableTestDb } = require('./helpers/dbGuard'); assertDisposableTestDb();` before queries, plus code formatting.
   - *Reason*: Enforces safety guard ensuring integration tests only run against dedicated `*_test` databases.
   - *Recommendation*: **Include in commit**.

5. **`backend/package.json` & `backend/package-lock.json` (Tracked / Modified)**:
   - *Change*: Minor bump of `uuid` dependency to `^11.1.1`.
   - *Reason*: Standard package-lock resolution during local dependency audit.
   - *Recommendation*: **Include in commit**.

6. **`backend/README.md` (Untracked / New)**:
   - *Change*: Replaced an empty 0-byte file with a quickstart guide referencing root documentation.
   - *Reason*: Provides clear directory-level instructions for backend navigation.
   - *Recommendation*: **Include in commit**.

---

## 5. Section D: Local Configuration Changes (DO NOT COMMIT)

The following configuration files contain local environment secrets or machine-specific network settings and **must never be committed to Git**:

- **`backend/.env`**:
  - Contains local PostgreSQL database credentials (`PGPASSWORD`), MongoDB connection strings, and transactional Brevo API keys (`BREVO_API_KEY`).
  - Contains local port mappings: `FRONTEND_URL=http://localhost:5174` and `CORS_ORIGIN=http://localhost:5174`.
  - *Ignored by*: `backend/.gitignore` (Line 3).
- **`frontend/.env`**:
  - Local overrides for Vite environment variables.
  - *Ignored by*: `frontend/.gitignore` (Line 14).

Safe, placeholder-only configuration templates are committed for reference:
- [`backend/.env.example`](../backend/.env.example)
- [`frontend/.env.example`](../frontend/.env.example)

---

## 6. Section E: Teammate Setup & Reproduction Guide

To run the full stack locally after cloning the repository:

### Step 1: Start Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit backend/.env with your local PostgreSQL password
npm run dev
```
*Backend runs at `http://localhost:3000`.*

### Step 2: Start Frontend
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs at `http://localhost:5173` (or `http://localhost:5174` if 5173 is busy).*

### Port Synchronization Note:
If the frontend runs on port `5174` (e.g., if port 5173 is in use on Windows), update `backend/.env`:
```env
FRONTEND_URL=http://localhost:5174
CORS_ORIGIN=http://localhost:5174
```
This ensures password reset links delivered via email point directly to the active frontend instance.

---

## 7. Section F: Integration Contracts for Other Teams (C2 – C5)

Teams integrating with Team 1 (Trains & Routes C2, Booking C3, Payments C4, Notifications C5) must follow these specifications:

### 1. Authenticating API Requests
Send the JWT access token in the standard HTTP header:
```http
Authorization: Bearer <accessToken>
```

### 2. Token Payload & Roles
Access tokens are signed using HS256 and contain the following payload structure:
```json
{
  "sub": 1,
  "role": "CUSTOMER",
  "iat": 1729500000,
  "exp": 1729500900
}
```
Available roles:
- `CUSTOMER`: Standard passenger workflows (Find Trains, View Schedules, Create Bookings).
- `STAFF`: Station operations and passenger manifest inquiries.
- `ADMIN`: Platform administration, system auditing, and account unlocking.

### 3. Session Expiration & Refresh Flow
Access tokens expire after 15 minutes (`JWT_EXPIRES_IN=15m`). When an API responds with `401 UNAUTHENTICATED`, clients should invoke token rotation:
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "<refreshToken>"
}
```
On success, the backend returns a new access token and revokes/replaces the refresh token.

### 4. Development Accounts for Cross-Team Testing
All accounts use the password: `Railway@Dev123`
- **Customer**: `customer@example.com` (`ACTIVE`)
- **Staff**: `staff@example.com` (`ACTIVE`)
- **Admin**: `admin@example.com` (`ACTIVE`)
- **Locked**: `locked@example.com` (`LOCKED`)
- **Suspended**: `suspended@example.com` (`SUSPENDED`)

---

## 8. Section G: Verification Results

| Test Category | Target / Scope | Result | Details |
|---|---|---|---|
| **Frontend Production Build** | `frontend/` (`npm run build`) | **PASSED** | 48 modules transformed, zero syntax errors, assets bundled to `dist/` in 826 ms. |
| **Backend Offline Unit Tests** | `backend/` (`npm test`) | **174 / 174 PASSED** | 7 suites passed in 14.48 s. Covers token crypto, sanitization, rate-limiting, and RBAC. |
| **Password Reset Link Generation** | `emailService.buildResetUrl` | **PASSED** | Generates `http://localhost:5174/reset-password?token=...` matching the active frontend port. |
| **Role Boundary Enforcement** | `ProtectedRoute` & Live API | **PASSED** | Navigating to `/admin` as `CUSTOMER` is blocked with HTTP 403 / `/unauthorized`. |
| **Locked Account Security** | `POST /api/auth/login` | **PASSED** | Returns HTTP 403 `ACCOUNT_NOT_ACTIVE` with clear user lockout message. |
| **Suspended Account Security** | `POST /api/auth/login` | **PASSED** | Returns HTTP 403 `ACCOUNT_NOT_ACTIVE` with clear suspension message. |
| **Database-Backed Integration Tests** | `npm run test:db` | *Requires Setup* | Requires dedicated disposable `railway_test` database (protected by `dbGuard.js`). |
| **MongoDB Audit Log Persistence** | `backend/` | *Degraded Mode* | Backend operates in documented fallback mode when MongoDB is offline. |

---

## 9. File-by-File Change Matrix

| File Path | Status | Nature of Change | Purpose / Rationale | Handover Inclusion |
|---|---|---|---|---|
| `frontend/**` (entire directory) | Untracked / New | Complete React + Vite frontend | Full user interface and auth integration for Team 1 | **YES (Core Deliverable)** |
| `frontend/.gitignore` | Untracked / New | Git ignore rules | Protects `node_modules`, `dist`, `.env` | **YES** |
| `frontend/.env.example` | Untracked / New | Env template | Safe placeholder configuration for teammates | **YES** |
| `frontend/README.md` | Untracked / New | Frontend documentation | Setup, run, and architecture guide | **YES** |
| `docs/team-1-integration-handover.md` | Untracked / New | Integration handover document | Comprehensive module summary for other teams | **YES** |
| `backend/tests/unit/emailDelivery.test.js` | Tracked / Modified | Test expectation update | Evaluates configured base URL rather than hardcoded port 5173 | **YES (Recommended)** |
| `backend/jest.config.js` | Tracked / Modified | Test timeout config | Replaces project timeouts with setup helpers | **YES (Recommended)** |
| `backend/tests/helpers/unitTimeout.js` | Untracked / New | Jest helper | 30s timeout hook for unit tests | **YES (Recommended)** |
| `backend/tests/helpers/dbTimeout.js` | Untracked / New | Jest helper | 60s timeout hook for integration tests | **YES (Recommended)** |
| `backend/tests/auth.test.js` | Tracked / Modified | Safety assertion + formatting | Added `assertDisposableTestDb()` guard | **YES (Recommended)** |
| `backend/package.json` | Tracked / Modified | Dependency bump | `uuid` ^11.1.1 | **YES (Recommended)** |
| `backend/package-lock.json` | Tracked / Modified | Lockfile update | `uuid` resolution | **YES (Recommended)** |
| `backend/README.md` | Untracked / New | Directory quickstart | Points to root README and docs | **YES (Optional)** |
| `backend/.env` | Ignored | Local credentials & ports | Machine-specific dev secrets | **NO (STRICTLY FORBIDDEN)** |
| `frontend/.env` | Ignored | Local frontend overrides | Machine-specific dev secrets | **NO (STRICTLY FORBIDDEN)** |
