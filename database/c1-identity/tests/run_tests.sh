#!/usr/bin/env bash
# Builds a throwaway database from scratch and runs every C1 database test.
# Usage:  PGHOST=localhost PGPORT=5432 PGUSER=postgres ./tests/run_tests.sh
# Needs: psql, createdb/dropdb; python3 + bcrypt (pip install bcrypt) for the hash check.
set -euo pipefail
cd "$(dirname "$0")/.."

DB="${TEST_DB:-railway_c1_test}"
export PGOPTIONS="${PGOPTIONS:--c client_min_messages=warning}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -d "$DB")

echo "== clean setup: recreate $DB"
dropdb --if-exists "$DB"
createdb "$DB"

echo "== apply schema + seeds"
"${PSQL[@]}" -f schema.sql
"${PSQL[@]}" -f schema_auth_tokens.sql
"${PSQL[@]}" -f seed.sql
"${PSQL[@]}" -o /dev/null -f seed_dev_users.sql

snapshot() {
  "${PSQL[@]}" -At -c "
    SELECT (SELECT count(*) FROM roles), (SELECT count(*) FROM permissions),
           (SELECT count(*) FROM role_permissions), (SELECT count(*) FROM users),
           (SELECT count(*) FROM staff),
           (SELECT string_agg(r.role_name||':'||p.permission_name, ',' ORDER BY 1)
              FROM role_permissions rp JOIN roles r USING (role_id) JOIN permissions p USING (permission_id))"
}

echo "== seed repeatability: run both seeds a second time"
before="$(snapshot)"
"${PSQL[@]}" -f seed.sql
"${PSQL[@]}" -o /dev/null -f seed_dev_users.sql
after="$(snapshot)"
[[ "$before" == "$after" ]] || { echo "FAIL  re-running seeds changed data"; echo "$before"; echo "$after"; exit 1; }
echo "PASS  re-running seeds changes nothing"

echo "== matrix is source of truth: stray mapping is removed by seed.sql"
"${PSQL[@]}" -c "INSERT INTO role_permissions SELECT r.role_id, p.permission_id FROM roles r, permissions p
                 WHERE r.role_name='CUSTOMER' AND p.permission_name='MANAGE_USERS'"
"${PSQL[@]}" -f seed.sql
[[ "$(snapshot)" == "$before" ]] || { echo "FAIL  stray mapping survived re-seed"; exit 1; }
echo "PASS  stray CUSTOMER→MANAGE_USERS mapping removed by re-seed"

echo "== schema re-run on a populated DB rebuilds cleanly"
"${PSQL[@]}" -f schema.sql
"${PSQL[@]}" -f schema_auth_tokens.sql
"${PSQL[@]}" -f seed.sql
"${PSQL[@]}" -o /dev/null -f seed_dev_users.sql
[[ "$(snapshot)" == "$before" ]] || { echo "FAIL  rebuild differs"; exit 1; }
echo "PASS  full rebuild reproduces identical data"

echo "== dev account hashes verify with bcrypt"
"${PSQL[@]}" -At -c "SELECT email||' '||password_hash FROM users ORDER BY email" | python3 -c '
import sys, bcrypt
for line in sys.stdin:
    email, h = line.split()
    assert bcrypt.checkpw(b"Railway@Dev123", h.encode()), email
    assert not bcrypt.checkpw(b"wrong-password", h.encode()), email
    print("PASS  bcrypt verifies", email)
'

echo "== constraint / trigger / view tests"
"${PSQL[@]}" -o /dev/null -f tests/test_db.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'

dropdb "$DB"
echo "== ALL C1 DATABASE TESTS PASSED"
