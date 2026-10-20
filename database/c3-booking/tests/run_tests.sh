#!/usr/bin/env bash
# Builds a throwaway database (C1 + C3, with dev data) and runs every C3 database test.
# Usage:  PGHOST=localhost PGPORT=5432 PGUSER=postgres ./database/c3-booking/tests/run_tests.sh
# Needs: psql, createdb/dropdb.
set -euo pipefail
cd "$(dirname "$0")"

DB="${TEST_DB:-railway_c3_test}"
export PGOPTIONS="${PGOPTIONS:--c client_min_messages=warning}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -d "$DB")

echo "== clean setup: build $DB with database/setup.sh"
PGDATABASE="$DB" ../../setup.sh --reset > /dev/null

echo "== constraint / trigger / function tests"
"${PSQL[@]}" -o /dev/null -f test_db.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'

dropdb "$DB"
echo "== ALL C3 DATABASE TESTS PASSED"
