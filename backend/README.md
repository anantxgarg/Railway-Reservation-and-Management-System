# C1 Identity & Access Backend — Quickstart

The C1 Identity & Access backend provides secure authentication, authorization, token lifecycle management, and user auditing for the Railway Reservation & Management System.

Detailed documentation is available in:
- **API Specification & Endpoints**: [`../docs/API.md`](../docs/API.md)
- **Database Schema & Roles**: [`../database/c1-identity/README.md`](../database/c1-identity/README.md)
- **Root Setup Guide**: [`../README.md`](../README.md)

---

## Quickstart

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```
Update `.env` with your local PostgreSQL credentials (keep `.env` private and never commit it).

### 3. Initialize PostgreSQL Database
Execute scripts in sequence against the `railway` database:
```bash
psql -d railway -v ON_ERROR_STOP=1 -f ../database/c1-identity/schema.sql
psql -d railway -v ON_ERROR_STOP=1 -f ../database/c1-identity/schema_auth_tokens.sql
psql -d railway -v ON_ERROR_STOP=1 -f ../database/c1-identity/seed.sql
psql -d railway -v ON_ERROR_STOP=1 -f ../database/c1-identity/seed_dev_users.sql
```

### 4. Run Development Server
```bash
npm run dev
```
Server runs on `http://localhost:3000`.

### 5. Run Tests
```bash
npm test
```
Runs 174 offline unit tests covering token security, rate-limiting, authentication service, and RBAC rules.
