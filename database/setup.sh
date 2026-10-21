#!/usr/bin/env bash
# Builds the shared "railway" database from every team's SQL, in dependency order.
#
# Usage:  PGHOST=localhost PGUSER=postgres ./database/setup.sh [--reset] [--no-dev-data]
#   --reset        drop and recreate the database first (deletes ALL data in it)
#   --no-dev-data  skip development seed data (test users, sample network)
#
# Database name comes from PGDATABASE (default: railway). Connection settings use
# the standard PG* environment variables (PGHOST, PGPORT, PGUSER, PGPASSWORD).
#
# Order: C1 identity -> C3 booking (incl. network/concession placeholders).
# Team 4's app creates its own tables on startup (Flyway), so start it afterwards.
set -euo pipefail
cd "$(dirname "$0")"

DB="${PGDATABASE:-railway}"
RESET=0
DEV_DATA=1
for arg in "$@"; do
  case "$arg" in
    --reset)       RESET=1 ;;
    --no-dev-data) DEV_DATA=0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

export PGOPTIONS="${PGOPTIONS:--c client_min_messages=warning}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -d "$DB")
run() { echo "  $1"; "${PSQL[@]}" -o /dev/null -f "$1"; }

if [[ $RESET -eq 1 ]]; then
  echo "== dropping database $DB"
  dropdb --if-exists "$DB"
fi

if ! psql -X -At -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$DB'" | grep -q 1; then
  echo "== creating database $DB"
  createdb "$DB"
elif [[ -n "$("${PSQL[@]}" -At -c "SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'booking'")" ]]; then
  echo "database $DB already has the booking tables; rerun with --reset to rebuild it" >&2
  exit 1
fi

echo "== C1 identity (Team 1)"
run c1-identity/schema.sql
run c1-identity/schema_auth_tokens.sql
run c1-identity/seed.sql
[[ $DEV_DATA -eq 1 ]] && run c1-identity/seed_dev_users.sql

echo "== C3 booking (Team 3)"
for f in c3-booking/[0-9][0-9]_*.sql; do run "$f"; done
[[ $DEV_DATA -eq 1 ]] && run c3-booking/seed_dev.sql

echo "== done: database $DB is ready"
