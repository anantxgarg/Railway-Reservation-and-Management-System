# How to run the Team 3 demo

This branch runs Team 3's booking module on its own: PostgreSQL, `booking-service` (port 8082) and the frontend (port 5173). It doesn't need Team 1's login server or Team 4's payments app. `booking-service` runs in demo mode (`BOOKING_DEMO=true`), which stands in for both.

Run every command in **Git Bash** on Windows, or in a normal terminal on Linux/macOS.

---

## 0. One-time setup (skip on a machine that already has it)

You need Git, Java 17 or newer, Node.js 18 or newer, and PostgreSQL 14 or newer with `psql`, `createdb` and `dropdb` on the PATH. You don't need Maven: `booking-service/mvnw` downloads it.

**PostgreSQL:** choose one option.

- **Docker:**
  ```bash
  docker run -d --name railway-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
  ```
  You still need the `psql` client tools on the PATH.
- **Windows with MSYS2:** use this if the EnterpriseDB installer download fails.
  ```bash
  /c/msys64/usr/bin/pacman -S --noconfirm --needed mingw-w64-ucrt-x86_64-postgresql
  echo postgres > /tmp/pw.txt
  initdb -D /d/anant_dbm/pgdata -U postgres --pwfile=/tmp/pw.txt -A scram-sha-256 -E UTF8
  ```
- **Installer:** use the PostgreSQL installer (tick "Command Line Tools") and set the `postgres` password to `postgres`.

**Get the code:**
```bash
git clone https://github.com/anantxgarg/Railway-Reservation-and-Management-System.git
cd Railway-Reservation-and-Management-System
git checkout team3
```

**Create `.env` in the repo root.** Git ignores it, so never commit it.
```bash
printf 'PGHOST=localhost\nPGPORT=5432\nPGUSER=postgres\nPGPASSWORD=postgres\nPGDATABASE=railway\n' > .env
```
`JWT_SECRET` is optional. If it's missing, a random one is used for each run, so logins don't survive a restart.

---

## 1. Start PostgreSQL

| Setup | Command |
|---|---|
| Docker | `docker start railway-postgres` |
| MSYS2 / `initdb` folder | `pg_ctl -D /d/anant_dbm/pgdata -l /d/anant_dbm/pgdata.log start` |
| Installer | It runs as a Windows service, so it's already started. |

To check it's up, run this. It should print `1`:
```bash
PGPASSWORD=postgres psql -h localhost -U postgres -At -c "select 1"
```

## 2. Start the demo

```bash
./start-demo.sh --reset
```

What it does:
- `--reset` drops and rebuilds the `railway` database with fresh seed data. Leave it out to keep existing bookings.
- It starts `booking-service` with `BOOKING_DEMO=true`, then the frontend.
- The first run downloads Maven and the npm packages, so give it a few minutes.
- Wait for `Team 3 booking demo is running: http://localhost:5173`.
- Leave the terminal open. Logs go to `logs/booking-service.log` and `logs/frontend.log`.

## 3. Use it

Open **http://localhost:5173**. All accounts use the password `Railway@Dev123`:

| Account | Role | Can do |
|---|---|---|
| `customer@example.com` | CUSTOMER | search, book, pay (demo), cancel |
| `staff@example.com` | STAFF | search, open any PNR, can't book |
| `admin@example.com` | ADMIN | same as staff |

Demo walkthrough (about 5 minutes):

1. **Log in** as `customer@example.com`.
2. **Search** from `NDLS` to `BCT` for any date in the next 30 days. This shows the 12952 Mumbai Rajdhani. `NDLS` to `MAS` shows the 12622 Tamil Nadu Express.
3. **Check availability:** pick class **1A** and look at the free berths per class.
4. **Book** 2–3 passengers. You get a PNR in **HELD** state with a 15-minute hold.
5. **Pay (demo):** the booking becomes **CONFIRMED**, with a coach and berth for each passenger. This is a simulated payment that stands in for Team 4.
6. **Waitlist:** keep booking 1A on the same train and date until all 18 berths are taken. The next passenger gets **WL 1**.
7. **Cancel** one confirmed passenger. Open the waitlisted PNR: that passenger has moved up to **CNF** on the freed berth.
8. Show the **PNR status** and **My bookings** tabs.
9. Log in as `staff@example.com` and open any PNR. Staff can view bookings but can't book.

## 4. Stop

Press **Ctrl+C** in the demo terminal. That stops `booking-service` and the frontend. Then stop PostgreSQL if you started it yourself:

```bash
pg_ctl -D /d/anant_dbm/pgdata stop    # MSYS2 / initdb folder
docker stop railway-postgres          # Docker
```

---

## Tests

Run these with PostgreSQL running. Each one builds its own `*_test` database and leaves `railway` alone.

```bash
export PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=postgres
bash database/c3-booking/tests/run_tests.sh   # 92 database checks + 10-session race for the last berth
bash booking-service/run_tests.sh             # 57 API tests (incl. demo mode)
```

## Start each part by hand (if `start-demo.sh` gives trouble)

```bash
export PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=postgres PGDATABASE=railway
bash database/setup.sh --reset                     # build the database

# terminal 1: booking-service
cd booking-service
BOOKING_DEMO=true JWT_SECRET=any-string-of-at-least-32-characters-long ./mvnw spring-boot:run

# terminal 2: frontend
cd frontend
npm install
npm run dev
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `psql: command not found` | Add PostgreSQL's `bin` folder to the PATH (MSYS2: `C:\msys64\ucrt64\bin`). |
| `password authentication failed` | Fix `PGPASSWORD` in `.env`. |
| Port 8082 or 5173 already in use | An earlier run is still going. Stop it, or on Windows run `netstat -ano \| grep :8082` and then `taskkill //F //PID <pid>`. |
| Logged out after restarting the service | Expected without a fixed `JWT_SECRET`. Put one in `.env`. |
| No trains found | Seed runs cover the next 30 days from when the database was built. Run `./start-demo.sh --reset`. |
