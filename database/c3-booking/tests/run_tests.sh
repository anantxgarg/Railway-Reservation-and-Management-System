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

echo "== race: 10 concurrent bookings for the last free berth"
# 1A on the Rajdhani has 18 berths and no RAC. Fill 17, then let 10 sessions
# book one passenger each at the same moment. Each session keeps its
# transaction open briefly so the others really have to wait for it.
read -r USER_ID RUN < <("${PSQL[@]}" -At -F ' ' -c "
  SELECT (SELECT user_id FROM users WHERE email = 'customer@example.com'),
         (SELECT run_id FROM train_run WHERE train_no = '12952' AND run_date = CURRENT_DATE + 10)")
pax() { "${PSQL[@]}" -At -c "SELECT jsonb_agg(jsonb_build_object('name','P'||i,'age',30,'gender','M')) FROM generate_series(1,$1) i"; }
for n in 6 6 5; do
  "${PSQL[@]}" -o /dev/null -c "SELECT create_booking($USER_ID, $RUN, '1A', 'GN', 1, 4, '$(pax "$n")')"
done
ONE="$(pax 1)"
for _ in $(seq 10); do
  "${PSQL[@]}" -o /dev/null -c "BEGIN" \
    -c "SELECT create_booking($USER_ID, $RUN, '1A', 'GN', 1, 4, '$ONE')" \
    -c "SELECT pg_sleep(0.2)" -c "COMMIT" &
done
wait
result="$("${PSQL[@]}" -At -F ' ' -c "
  SELECT (SELECT count(*) FROM seat_allocation WHERE run_id = $RUN),
         (SELECT count(DISTINCT seat_id) FROM seat_allocation WHERE run_id = $RUN),
         (SELECT count(*) FROM booking b JOIN passenger p USING (pnr)
          WHERE b.run_id = $RUN AND p.status = 'CONFIRMED'),
         (SELECT string_agg(queue_no::TEXT, ',' ORDER BY queue_no) FROM booking b JOIN passenger p USING (pnr)
          WHERE b.run_id = $RUN AND p.status = 'WAITLIST')")"
[[ "$result" == "18 18 18 1,2,3,4,5,6,7,8,9" ]] || { echo "FAIL  race: got '$result'"; exit 1; }
echo "PASS  race: 1 of 10 got the last berth, 9 waitlisted as WL 1-9, no berth sold twice"

dropdb "$DB"
echo "== ALL C3 DATABASE TESTS PASSED"
