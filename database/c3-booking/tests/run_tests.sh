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

echo "== notifications for Team 6 (notification_outbox), in committed transactions"
# The promotion trigger runs at COMMIT, so these steps can't live in the
# rolled-back test_db.sql. 2A on the Rajdhani 3 days out: 2 coaches of 48
# berths and 8 RAC places.
q() { "${PSQL[@]}" -At -c "$1"; }
check() { [[ "$2" == "$3" ]] || { echo "FAIL  $1: got '$2', expected '$3'"; exit 1; }; echo "PASS  $1"; }
RUN3="$(q "SELECT run_id FROM train_run WHERE train_no = '12952' AND run_date = CURRENT_DATE + 3")"
book() { q "SELECT create_booking($USER_ID, $RUN3, '2A', 'GN', 1, 4, '$(pax "$1")')"; }
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16; do book 6 > /dev/null; done   # 96 berths, 0 left
RAC_PNR="$(book 1)"                                                               # RAC 1
for _ in 1 2 3 4 5 6 7; do book 1 > /dev/null; done                               # RAC 2-8, RAC full
WL_PNR="$(book 1)"                                                                # WL 1
check "outbox: nothing queued for new, unpaid bookings" "$(q "SELECT count(*) FROM notification_outbox")" "0"

q "SELECT confirm_booking('$RAC_PNR')" > /dev/null
check "outbox: paying queues BOOKING_CONFIRMED with Team 6's fields" \
  "$(q "SELECT data->>'bookingStatus' || ' ' || (data->>'passengerCount') || ' ' || (data->>'fromStation') || '-' || (data->>'toStation')
        FROM notification_outbox WHERE pnr = '$RAC_PNR' AND type = 'BOOKING_CONFIRMED'")" "RAC 1 NDLS-BCT"

FIRST="$(q "SELECT pnr FROM booking WHERE run_id = $RUN3 AND class_code = '2A' ORDER BY pnr LIMIT 1")"
q "SELECT count(*) FROM cancel_passengers('$FIRST', ARRAY[(SELECT min(passenger_id) FROM passenger WHERE pnr = '$FIRST')])" > /dev/null
check "outbox: a freed berth sends RAC 1 to a berth (RAC_TO_CNF, with coach and seat)" \
  "$(q "SELECT data->>'oldStatus' || ' ' || (data->>'coach' ~ '^A[0-9]$') FROM notification_outbox WHERE pnr = '$RAC_PNR' AND type = 'RAC_TO_CNF'")" "RAC 1 true"
check "outbox: and WL 1 to the free RAC place (WL_TO_RAC)" \
  "$(q "SELECT data->>'oldStatus' || ' -> ' || (data->>'newStatus') FROM notification_outbox WHERE pnr = '$WL_PNR' AND type = 'WL_TO_RAC'")" "WL 1 -> RAC 8"

check "outbox: journey reminders for paid bookings, once each" \
  "$(q "SELECT queue_journey_reminders(INTERVAL '40 days')") $(q "SELECT queue_journey_reminders(INTERVAL '40 days')")" "1 0"
check "outbox: journey completed for paid bookings of the run, once each" \
  "$(q "SELECT queue_journey_completed($RUN3)") $(q "SELECT queue_journey_completed($RUN3)")" "1 0"
check "outbox: completed journey carries the timetable times" \
  "$(q "SELECT data->>'departureTime' || '-' || (data->>'arrivalTime') FROM notification_outbox WHERE type = 'JOURNEY_COMPLETED'")" "16:55-08:25"

dropdb "$DB"
echo "== ALL C3 DATABASE TESTS PASSED"
