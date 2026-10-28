#!/usr/bin/env bash
# start-all.sh: starts all six services from one terminal. Run from the repo root.
# Logs go to logs/<service>.log. Ctrl+C stops everything.
cd "$(dirname "$0")"
set -a; source .env; set +a
# Payments port: 8081 unless .env sets PAYMENTS_PORT (e.g. when 8081 is taken)
export PAYMENTS_PORT=${PAYMENTS_PORT:-8081}
export PAYMENTS_URL=${PAYMENTS_URL:-http://localhost:$PAYMENTS_PORT}
mkdir -p logs

# Background jobs in a script ignore Ctrl+C, so stop the whole process group ourselves.
trap 'trap - INT TERM; echo "stopping..."; kill 0' INT TERM

(cd backend && npm start > ../logs/team1.log 2>&1) &
(cd train-service && ./mvnw spring-boot:run > ../logs/team2.log 2>&1) &
(cd booking-service && ./mvnw spring-boot:run > ../logs/team3.log 2>&1) &
./mvnw spring-boot:run > logs/team4.log 2>&1 &
(cd notification-service && ./mvnw spring-boot:run > ../logs/team6.log 2>&1) &
(cd frontend && npm run dev > ../logs/frontend.log 2>&1) &

echo "Starting... open http://localhost:5173 in about a minute. Logs: logs/*.log. Ctrl+C to stop."
wait
