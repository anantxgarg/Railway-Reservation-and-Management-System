# How to run the Railway Reservation System

Everything runs **on your own machine**: one PostgreSQL database, one MongoDB, five backends and one React app. No hosted databases, no shared servers. Every team member gets an identical copy from the same scripts.

At the end you open http://localhost:5173 and log in as `customer@example.com` / `Railway@Dev123`.

---

## 1. What runs where

| What | Folder | Port | Needs |
|---|---|---|---|
| PostgreSQL (all teams' tables) | `database/` | 5432 | |
| MongoDB (notifications, feedback, audit log) | | 27017 | |
| Team 1: users and login | `backend/` | 3000 | PostgreSQL, MongoDB |
| Team 2: trains, stations, live status | `train-service/` | 8083 | PostgreSQL |
| Team 3: search, booking, PNR | `booking-service/` | 8082 | PostgreSQL |
| Team 4: payments, refunds, concessions | repo root (`src/`, `pom.xml`) | 8081 | PostgreSQL, Razorpay test keys |
| Team 6: notifications, feedback | `notification-service/` | 8086 | MongoDB |
| Frontend (every team's screens) | `frontend/` | 5173 | all of the above |

The browser only talks to http://localhost:5173. The frontend's dev server forwards each `/api/...` path to the backend that owns it.

---

## 2. Install the tools

| Tool | Version | Check with |
|---|---|---|
| Git | any | `git --version` |
| Node.js | 18 or newer (20 recommended) | `node -v` |
| Java (JDK) | 17 or newer | `java -version` |
| PostgreSQL **client** (`psql`, `createdb`, `dropdb`) | 14 or newer | `psql --version` |
| Docker (recommended, for PostgreSQL and MongoDB) | any | `docker --version` |

You don't need Maven. Every Java app has its own `./mvnw` (`mvnw.cmd` on Windows).

Ubuntu/Debian:

```bash
sudo apt install git nodejs npm openjdk-17-jdk postgresql-client docker.io
```

macOS (Homebrew):

```bash
brew install git node openjdk@17 libpq && brew link --force libpq
```

Then install Docker Desktop.

Windows: install Git for Windows, Node.js LTS, Temurin JDK 17, Docker Desktop, and the PostgreSQL installer (tick "Command Line Tools"). Run the commands below in **Git Bash**.

---

## 3. Start PostgreSQL and MongoDB

### Option A: Docker (recommended, same for everyone)

```bash
docker run -d --name railway-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
docker run -d --name railway-mongo -p 27017:27017 mongo:7
```

This gives you PostgreSQL user `postgres`, password `postgres`, and MongoDB with no password.

To start them again after a reboot:

```bash
docker start railway-postgres railway-mongo
```

### Option B: installed locally

If PostgreSQL is installed on the machine, give the `postgres` user the password `postgres` (or use your own and put it in `.env` below):

```bash
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
```

Install MongoDB Community and leave it on port 27017 without a password.

> If something else already uses port 5432, 27017 or 8081, see [Troubleshooting](#9-troubleshooting).

---

## 4. Create your `.env`

Create a file called **`.env`** in the repo root, next to `pom.xml`. Git ignores it (`.gitignore`), so it never gets committed. **Never commit real keys.**

First make your JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Then paste this into `.env` and fill in the two marked lines:

```bash
# ---------- Database (PostgreSQL), used by setup.sh and every backend ----------
PGHOST=localhost
PGPORT=5432
PGDATABASE=railway
PGUSER=postgres
PGPASSWORD=postgres

# ---------- Login tokens, the SAME value for all five backends ----------
# Team 1 signs logins with it; Teams 2, 3, 4 and 6 check them with it.
JWT_SECRET=PASTE_THE_GENERATED_SECRET_HERE

# ---------- MongoDB ----------
MONGO_URI=mongodb://localhost:27017/railway                # Team 1 audit log
TEAM6_MONGO_URI=mongodb://localhost:27017/team6_railway    # Team 6 notifications and feedback

# ---------- Razorpay (Team 4), TEST-mode keys only ----------
RAZORPAY_KEY_ID=rzp_test_PASTE_YOURS
RAZORPAY_KEY_SECRET=PASTE_YOURS
RAZORPAY_WEBHOOK_SECRET=any-string-you-like

# ---------- Notifications between services (optional) ----------
# Same value for booking-service and notification-service. Empty = no check (fine locally).
NOTIFICATIONS_API_KEY=

# ---------- Team 1 (backend/) ----------
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
FRONTEND_URL=http://localhost:5173
# No e-mail service locally: the reset link is returned in the API response instead
DEV_EXPOSE_RESET_TOKEN=true
BREVO_API_KEY=
EMAIL_FROM="Railway Reservation <noreply@railway.local>"

# ---------- Team 6 demo buttons (optional) ----------
TEAM6_DEMO=false
VITE_TEAM6_DEMO=false
```

Every terminal you start a service in loads this file first:

```bash
set -a; source .env; set +a
```

Run that from the repo root. Team 1's backend would also read `backend/.env`, but it doesn't need one once the variables are loaded like this.

### The keys and passwords, one by one

| What | Value | Where it comes from |
|---|---|---|
| PostgreSQL user / password | `postgres` / `postgres` | Set by the Docker command in step 3 (or by you) |
| MongoDB | no user, no password | Local only |
| `JWT_SECRET` | 128 hex characters | **Generate it yourself** (command above). At least 32 characters, and the same in every backend |
| Razorpay key id / secret | `rzp_test_...` / secret | [dashboard.razorpay.com](https://dashboard.razorpay.com), switch to **Test Mode** → Account & Settings → API Keys → Generate Test Key. Each member can use their own; test mode never moves real money |
| `RAZORPAY_WEBHOOK_SECRET` | any string | Only matters if you set up the webhook (section 8) |
| `NOTIFICATIONS_API_KEY` | empty, or any string | Optional |
| `BREVO_API_KEY` | empty | Only needed to really send password-reset e-mails |
| App logins | see section 7 | Created by `setup.sh` |

Without Razorpay keys everything works **except paying**: the Pay button shows "Could not start the payment".

---

## 5. Build the database

From the repo root:

```bash
set -a; source .env; set +a
./database/setup.sh             # first time: creates "railway" with all tables and demo data
./database/setup.sh --reset     # any time later: wipe and rebuild from scratch
```

It runs every team's SQL in order (Team 1 identity → Team 2 network → Team 3 booking, with Team 4's concessions). The demo data includes:
- the test users;
- 12 stations and 6 trains;
- train runs for the next 30 days.

Team 4's own tables are created by the payments app the first time it starts, so **build the database before starting the payments app**.

---

## 6. Start everything

Open **six terminals**, all in the repo root. Run `set -a; source .env; set +a` in each, then:

```bash
# 1. Team 1: users and login (http://localhost:3000)
cd backend && npm ci && npm start

# 2. Team 2: trains (http://localhost:8083)
cd train-service && ./mvnw spring-boot:run

# 3. Team 3: booking (http://localhost:8082)
cd booking-service && ./mvnw spring-boot:run

# 4. Team 4: payments (http://localhost:8081), from the repo root itself
./mvnw spring-boot:run

# 5. Team 6: notifications (http://localhost:8086)
cd notification-service && ./mvnw spring-boot:run

# 6. Frontend (http://localhost:5173)
cd frontend && npm ci && npm run dev
```

The first `./mvnw` run downloads Maven and the libraries, which takes a few minutes. Later runs are quick. `npm ci` only needs re-running when `package-lock.json` changes.

On Windows (Git Bash) the same commands work. In `cmd`, use `mvnw.cmd spring-boot:run` and `set NAME=value`.

### Check it's up

```bash
curl http://localhost:3000/health                      # Team 1: 200
curl http://localhost:8081/api/concessions/rules       # Team 4: list of 5 concessions
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8082/api/bookings   # Team 3: 401 (up, wants a login)
curl http://localhost:5173/api/auth/login -H 'Content-Type: application/json' \
     -d '{"email":"customer@example.com","password":"Railway@Dev123"}'        # through the frontend: a token
```

---

## 7. Log in and try it

Open **http://localhost:5173**. Every demo account has the password **`Railway@Dev123`**.

| E-mail | Role | Use it for |
|---|---|---|
| `customer@example.com` | Customer | Search, book, pay, cancel, concessions, notifications, feedback |
| `staff@example.com` | Staff | Look up any PNR, review concession documents, set a train's status and delay (Trains tab) |
| `admin@example.com` | Admin | User lookup, unlock accounts (also via http://localhost:5173/admin/login) |
| `locked@example.com` | Customer, locked | Shows the "account locked" error |
| `suspended@example.com` | Customer, suspended | Shows the "account suspended" error |

These accounts exist only in your local database (`database/c1-identity/seed_dev_users.sql`).

A full run-through:
1. As the customer, **Book**: from `CSMT` to `PUNE` (or `NDLS` to `BCT`, `MAS`, `NGP`; or between `PUNE`, `SUR`, `UBL`), any of the next 30 days.
2. Add passengers. Pick a **concession** for one if you like, e.g. Student. **Hold seats**.
3. **Pay** with Razorpay's test card:
   - card `4111 1111 1111 1111`, any future expiry, any CVV, any OTP;
   - or UPI `success@razorpay`.
4. The **bell** shows "booking confirmed" and "payment received".
5. **Concessions** tab: send the documents for the concession. Log in as staff to approve them.
6. As **staff**, on the **Trains** tab:
   - set the day's run to `DELAYED`: the customer's **Live status** follows;
   - set it to `ARRIVED`: the customer gets a "journey completed" notification that opens the **feedback** form.
7. Cancel a paid booking from its PNR page. The refund follows the time left before departure.

---

## 8. Optional extras

**Razorpay webhook** (payments confirmed even if the browser closes; not needed locally):
1. `ngrok http 8081`.
2. In the Razorpay dashboard (Test Mode): Webhooks → Add.
   - URL: `https://<your-ngrok>/api/payments/webhook`
   - Secret: your `RAZORPAY_WEBHOOK_SECRET`
   - Events: `payment.captured`, `payment.failed`, `refund.processed`, `refund.failed`
3. In Settings → Payment Capture, turn on **auto-capture**, otherwise refunds fail.

**Team 6 demo buttons** (fake journey, reset all notifications): set `TEAM6_DEMO=true` and `VITE_TEAM6_DEMO=true` in `.env`, then restart notification-service and the frontend.

**Real password-reset e-mails:** put a [Brevo](https://www.brevo.com) API key in `BREVO_API_KEY`, set `EMAIL_FROM` to a sender verified there, and `DEV_EXPOSE_RESET_TOKEN=false`.

---

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| `JWT_SECRET ... missing` / `must be at least 32 characters` | `.env` not loaded in that terminal (`set -a; source .env; set +a`), or the secret is too short |
| Logged in, but other tabs say 401 / "Authentication required" | The backends have different `JWT_SECRET`s. Load the same `.env` everywhere and restart them |
| `database "railway" already has the booking tables` | Use `./database/setup.sh --reset` |
| `psql: command not found` | Install the PostgreSQL client (step 2) |
| `password authentication failed for user "postgres"` | `PGPASSWORD` in `.env` doesn't match your PostgreSQL |
| Payments app stops with a Flyway error about `booking` | Build the database (step 5) before starting it |
| Port already in use (e.g. 8081) | Change it: `PAYMENTS_PORT=8091 ./mvnw spring-boot:run`, and start the frontend with `PAYMENTS_URL=http://localhost:8091 npm run dev`. Likewise `PORT`/`AUTH_URL`, `BOOKING_PORT`/`BOOKING_URL`, `TRAIN_PORT`/`TRAIN_URL`, `NOTIFICATIONS_PORT`/`NOTIFICATIONS_URL` |
| Port 5432 or 27017 taken by an installed database | Use it (option B), or map Docker elsewhere (`-p 5433:5432`) and set `PGPORT=5433` / the Mongo URIs |
| No notifications | notification-service or MongoDB isn't running. Undelivered notifications wait in the `notification_outbox` table and are retried |
| Pay button: "Could not start the payment" | Razorpay keys missing or wrong (must be **test** keys) |
| `EBADENGINE` warning on `npm ci` | Harmless on Node 18 |
| Something is broken after pulling | `./database/setup.sh --reset`, restart every service, `npm ci` in `backend/` and `frontend/` |

---

## 10. Running the tests

The tests use their own databases (`railway_test`, `railway_c2_test`, `railway_c3_test`) and never touch `railway`. Load `.env` first. Payments tests mock Razorpay, so they need no keys.

```bash
cd backend && npm test && cd ..                                       # Team 1 unit
PGDATABASE=railway_test ./database/setup.sh --reset && (cd backend && npm run test:db)   # Team 1 database
./database/c2-network/tests/run_tests.sh                              # Team 2 database
./train-service/run_tests.sh                                          # Team 2 API
./database/c3-booking/tests/run_tests.sh                              # Team 3 database
./booking-service/run_tests.sh                                        # Team 3 API
PGDATABASE=railway_test ./database/setup.sh --reset && ./mvnw test    # Team 4
(cd notification-service && ./mvnw test)                              # Team 6 (MongoDB on 27017)
(cd frontend && npm run build)                                        # frontend
```

Run them one at a time: several rebuild `railway_test`. GitHub runs all of them on every pull request.
