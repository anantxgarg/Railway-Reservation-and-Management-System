#!/usr/bin/env bash
# Builds a throwaway database (C1 + C2 + C3, with dev data) and runs the C2 network tests.
# Usage:  PGHOST=localhost PGPORT=5432 PGUSER=postgres ./database/c2-network/tests/run_tests.sh
# Needs: psql, createdb/dropdb.
set -euo pipefail
cd "$(dirname "$0")"

DB="${TEST_DB:-railway_c2_test}"
export PGOPTIONS="${PGOPTIONS:--c client_min_messages=warning}"

echo "== clean setup: build $DB with database/setup.sh"
PGDATABASE="$DB" ../../setup.sh --reset > /dev/null

echo "== network tests"
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -o /dev/null -f test_network.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'

dropdb "$DB"
echo "== ALL C2 NETWORK TESTS PASSED"
