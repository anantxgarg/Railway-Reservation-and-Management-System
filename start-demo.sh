#!/usr/bin/env bash
# start-demo.sh: starts the Team 3 booking demo from one terminal.
#
#   ./start-demo.sh            build the database if needed, start booking-service and the frontend
#   ./start-demo.sh --reset    drop and rebuild the database first (deletes all bookings in it)
#
# Runs PostgreSQL-backed booking-service (port 8082, BOOKING_DEMO=true) and the
# React frontend (port 5173). Logs go to logs/booking-service.log and
# logs/frontend.log. Ctrl+C stops both.
#
# Settings come from .env in the repo root when it exists (see README.md):
#   PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE JWT_SECRET BOOKING_PORT
# Works in Git Bash on Windows and in bash on Linux and macOS (bash 3.2+).
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(pwd)"

usage() { awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; }

RESET=0
for arg in "$@"; do
  case "$arg" in
    --reset)   RESET=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown option: $arg (try --help)" >&2; exit 2 ;;
  esac
done

say()  { printf '== %s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
die()  { printf 'error: %s\n' "$*" >&2; exit 1; }

IS_WINDOWS=0
[[ "${OS:-}" == "Windows_NT" ]] && IS_WINDOWS=1

# ---------------------------------------------------------------------------
# Settings: .env (CRLF-safe), then defaults
# ---------------------------------------------------------------------------
if [[ -f .env ]]; then
  say "loading .env"
  set -a
  # Strip Windows line endings. eval, not "source <(...)", which bash 3.2 (macOS) can't do.
  eval "$(sed 's/\r$//' .env)"
  set +a
fi

export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-postgres}"
export PGDATABASE="${PGDATABASE:-railway}"
[[ -n "${PGPASSWORD:-}" ]] && export PGPASSWORD
export BOOKING_PORT="${BOOKING_PORT:-8082}"
FRONTEND_PORT=5173                      # fixed in frontend/vite.config.js (strictPort)
export BOOKING_URL="http://localhost:$BOOKING_PORT"   # where the Vite dev proxy sends /api

[[ "$PGDATABASE" =~ ^[A-Za-z0-9_]+$ ]] || die "PGDATABASE must be letters, digits and _ only (got '$PGDATABASE')"

# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------
need() {
  command -v "$1" > /dev/null 2>&1 || die "'$1' not found on PATH. $2"
}
PG_HINT="Install the PostgreSQL client tools (Windows: PostgreSQL installer with 'Command Line Tools' and add its bin folder to PATH; Ubuntu: sudo apt install postgresql-client; macOS: brew install libpq && brew link --force libpq)."
need psql     "$PG_HINT"
need createdb "$PG_HINT"
need dropdb   "$PG_HINT"
need java     "Install a JDK 17 or newer (e.g. Temurin 17) and make sure 'java' is on PATH."
need node     "Install Node.js 18 or newer (20 LTS recommended)."
need npm      "npm comes with Node.js; reinstall Node.js 18+."
need curl     "Install curl (it ships with Git for Windows, macOS and most Linux distributions)."

java_major="$(java -version 2>&1 | sed -n 's/.*version "\([0-9][0-9]*\)\.\{0,1\}\([0-9]*\).*/\1 \2/p' | head -n 1)"
java_major="${java_major%% *}"
[[ "$java_major" == "1" ]] && java_major=8
if [[ -n "$java_major" && "$java_major" -lt 17 ]]; then
  die "Java $java_major found; booking-service needs Java 17 or newer."
fi
node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
[[ "$node_major" -ge 18 ]] || die "Node.js $node_major found; the frontend (Vite 5) needs Node.js 18 or newer."

# Login tokens are signed with JWT_SECRET. Without one, make a throwaway secret
# for this run (logins from an earlier run then stop working, which is fine).
if [[ -z "${JWT_SECRET:-}" ]]; then
  JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")"
  say "JWT_SECRET not set: using a random one for this run (set it in .env to keep logins across restarts)"
fi
export JWT_SECRET

# ---------------------------------------------------------------------------
# Ports must be free, so anything on them later is ours to stop
# ---------------------------------------------------------------------------
answers() { curl -s -o /dev/null --max-time 2 "$1"; }   # any HTTP answer (even 401) counts

answers "http://localhost:$BOOKING_PORT/" && die "port $BOOKING_PORT is already in use (an earlier demo still running?). Stop it, or set BOOKING_PORT in .env."
answers "http://localhost:$FRONTEND_PORT/" && die "port $FRONTEND_PORT is already in use (an earlier demo still running?). Stop it first."

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
say "checking PostgreSQL at $PGHOST:$PGPORT as $PGUSER"
if ! pg_err="$(psql -X -w -At -d postgres -c 'SELECT 1' 2>&1 > /dev/null)"; then
  printf '%s\n' "$pg_err" >&2
  die "cannot connect to PostgreSQL. Is it running? Check PGHOST/PGPORT/PGUSER/PGPASSWORD in .env.
       Quick start with Docker: docker run -d --name railway-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
       (then PGPASSWORD=postgres in .env)"
fi

booking_table_exists() {
  [[ -n "$(psql -X -w -At -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$PGDATABASE'")" ]] &&
  [[ -n "$(psql -X -w -At -c "SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'booking'")" ]]
}

if [[ $RESET -eq 1 ]]; then
  say "rebuilding database $PGDATABASE (--reset)"
  ./database/setup.sh --reset
elif booking_table_exists; then
  say "database $PGDATABASE already built (use --reset to rebuild it)"
else
  say "building database $PGDATABASE"
  ./database/setup.sh || die "database/setup.sh failed. If $PGDATABASE is half-built, rerun with --reset."
fi

# Dev data has train runs for the 30 days after the database was built.
future_runs="$(psql -X -w -At -c "SELECT count(*) FROM train_run WHERE run_date >= CURRENT_DATE + 3" 2>/dev/null || echo 0)"
if [[ "$future_runs" == "0" ]]; then
  warn "the sample trains have no runs left in the coming days; rerun with --reset for fresh dates."
fi

# ---------------------------------------------------------------------------
# Stopping: kill each process tree, then whatever still listens on our ports
# ---------------------------------------------------------------------------
BOOKING_PID=""
FRONTEND_PID=""
STARTED_PORTS=""

kill_tree() {   # kill_tree PID: the process and all its descendants
  local pid="$1" child winpid
  [[ -n "$pid" ]] || return 0
  if [[ $IS_WINDOWS -eq 1 ]]; then
    # mvnw and npm end up in native java.exe / node.exe; signals don't reach
    # them, so kill the whole Windows process tree.
    winpid="$(cat "/proc/$pid/winpid" 2>/dev/null || true)"
    [[ -n "$winpid" ]] && taskkill //F //T //PID "$winpid" > /dev/null 2>&1
    kill "$pid" 2> /dev/null || true
  else
    if command -v pgrep > /dev/null 2>&1; then
      for child in $(pgrep -P "$pid" 2> /dev/null); do kill_tree "$child"; done
    fi
    kill -TERM "$pid" 2> /dev/null || true
  fi
}

port_pids() {   # PIDs listening on a TCP port
  local port="$1"
  if [[ $IS_WINDOWS -eq 1 ]]; then
    # Listening sockets have foreign address 0.0.0.0:0 or [::]:0 (the State
    # column is translated on non-English Windows, so don't rely on it).
    netstat -ano 2> /dev/null | tr -d '\r' |
      awk -v p=":$port" '$1 == "TCP" && ($3 == "0.0.0.0:0" || $3 == "[::]:0") &&
                         substr($2, length($2) - length(p) + 1) == p { print $5 }' | sort -u
  elif command -v lsof > /dev/null 2>&1; then
    lsof -t -iTCP:"$port" -sTCP:LISTEN 2> /dev/null | sort -u
  elif command -v fuser > /dev/null 2>&1; then
    fuser "$port/tcp" 2> /dev/null | tr -s ' ' '\n' | grep -E '^[0-9]+$' || true
  fi
}

kill_port() {   # kill_port PORT [SIGNAL]
  local pid
  for pid in $(port_pids "$1"); do
    if [[ $IS_WINDOWS -eq 1 ]]; then
      taskkill //F //T //PID "$pid" > /dev/null 2>&1 || true
    else
      kill "-${2:-TERM}" "$pid" 2> /dev/null || true
    fi
  done
}

STOPPING=0
cleanup() {
  [[ $STOPPING -eq 1 ]] && return
  STOPPING=1
  trap - INT TERM EXIT
  echo
  say "stopping..."
  kill_tree "$FRONTEND_PID"
  kill_tree "$BOOKING_PID"
  local port i
  for port in $STARTED_PORTS; do kill_port "$port"; done
  # Give Spring Boot a moment to shut down, then force anything left.
  for i in 1 2 3 4 5 6 7 8 9 10; do
    [[ -z "$(for port in $STARTED_PORTS; do port_pids "$port"; done)" ]] && break
    sleep 1
  done
  for port in $STARTED_PORTS; do kill_port "$port" KILL; done
  say "stopped"
}
trap 'cleanup; exit 130' INT TERM
trap 'cleanup' EXIT

show_log_tail() { echo "---- last lines of $1 ----" >&2; tail -n 40 "$1" >&2 || true; echo "----" >&2; }

# wait_for URL PID LOG SECONDS NAME
wait_for() {
  local url="$1" pid="$2" log="$3" limit="$4" name="$5" waited=0
  until answers "$url"; do
    if ! kill -0 "$pid" 2> /dev/null; then
      show_log_tail "$log"
      die "$name stopped while starting; see $log"
    fi
    if [[ $waited -ge $limit ]]; then
      show_log_tail "$log"
      die "$name did not answer on $url within ${limit}s; see $log"
    fi
    sleep 2
    waited=$((waited + 2))
    if [[ $((waited % 30)) -eq 0 ]]; then echo "   still waiting for $name (${waited}s)..."; fi
  done
}

mkdir -p logs

# ---------------------------------------------------------------------------
# booking-service (demo mode: stands in for Team 1's login and Team 4's payment)
# ---------------------------------------------------------------------------
say "starting booking-service on port $BOOKING_PORT (BOOKING_DEMO=true); log: logs/booking-service.log"
say "the first start downloads Maven and the dependencies, which can take a few minutes"
STARTED_PORTS="$BOOKING_PORT"
(cd booking-service && BOOKING_DEMO=true exec ./mvnw -q spring-boot:run) > logs/booking-service.log 2>&1 &
BOOKING_PID=$!
wait_for "http://localhost:$BOOKING_PORT/api/search" "$BOOKING_PID" logs/booking-service.log 600 booking-service
say "booking-service is up at http://localhost:$BOOKING_PORT"

# ---------------------------------------------------------------------------
# frontend
# ---------------------------------------------------------------------------
if [[ ! -d frontend/node_modules ]]; then
  say "installing frontend dependencies (npm install)"
  (cd frontend && npm install --no-fund --no-audit) || die "npm install failed in frontend/"
fi
say "starting the frontend on port $FRONTEND_PORT; log: logs/frontend.log"
STARTED_PORTS="$BOOKING_PORT $FRONTEND_PORT"
(cd frontend && exec npm run dev) > logs/frontend.log 2>&1 &
FRONTEND_PID=$!
wait_for "http://localhost:$FRONTEND_PORT/" "$FRONTEND_PID" logs/frontend.log 120 frontend

cat <<EOF

  Team 3 booking demo is running:  http://localhost:$FRONTEND_PORT

  Log in with (password for all: Railway@Dev123)
    customer@example.com   CUSTOMER: search, book, pay (demo), cancel
    staff@example.com      STAFF:    search and open any PNR, can't book
    admin@example.com      ADMIN:    same as staff

  Try: NDLS -> BCT (12952 Rajdhani) or NDLS -> MAS (12622 Tamil Nadu Express), any date in the next 30 days.
  Logs: $ROOT/logs/booking-service.log, $ROOT/logs/frontend.log
  Press Ctrl+C to stop both.

EOF

# Stay in the foreground until Ctrl+C or until one of the two stops.
while kill -0 "$BOOKING_PID" 2> /dev/null && kill -0 "$FRONTEND_PID" 2> /dev/null; do
  sleep 2
done
if ! kill -0 "$BOOKING_PID" 2> /dev/null; then
  show_log_tail logs/booking-service.log
  warn "booking-service stopped; see logs/booking-service.log"
else
  show_log_tail logs/frontend.log
  warn "the frontend stopped; see logs/frontend.log"
fi
exit 1
