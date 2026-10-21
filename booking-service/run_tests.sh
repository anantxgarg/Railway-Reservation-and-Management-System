#!/usr/bin/env bash
# Rebuilds the test database with database/setup.sh, then runs the booking-service tests.
# Usage:  PGHOST=localhost PGPORT=5432 PGUSER=postgres ./booking-service/run_tests.sh
# Needs: psql, createdb/dropdb, Java 17+.
set -euo pipefail
cd "$(dirname "$0")"

export TEST_DB="${TEST_DB:-railway_test}"
[[ "$TEST_DB" == *_test ]] || { echo "TEST_DB must end in _test (it is dropped and rebuilt)" >&2; exit 2; }

echo "== build $TEST_DB with database/setup.sh"
PGDATABASE="$TEST_DB" ../database/setup.sh --reset > /dev/null

echo "== mvn test"
./mvnw -q -B test

echo "== ALL BOOKING-SERVICE TESTS PASSED"
