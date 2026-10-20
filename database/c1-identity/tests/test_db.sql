-- =====================================================================
-- C1 database tests. Expects schema.sql, schema_auth_tokens.sql,
-- seed.sql and seed_dev_users.sql to have been applied.
-- Everything runs inside one transaction and is ROLLED BACK, so the
-- database is unchanged afterwards. Any failure aborts with an error.
--   psql -d railway -v ON_ERROR_STOP=1 -f tests/test_db.sql
-- =====================================================================
\set QUIET on
BEGIN;
SET LOCAL client_min_messages = notice;

-- helper: run SQL, require it to fail with the given SQLSTATE --------------
CREATE FUNCTION pg_temp.expect_error(label TEXT, stmt TEXT, want TEXT) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    BEGIN
        EXECUTE stmt;
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = want THEN
            RAISE NOTICE 'PASS  %', label;
            RETURN;
        END IF;
        RAISE EXCEPTION 'FAIL  % — expected SQLSTATE %, got % (%)', label, want, SQLSTATE, SQLERRM;
    END;
    RAISE EXCEPTION 'FAIL  % — statement succeeded but should have failed', label;
END $$;

-- helper: require a boolean to be true ---------------------------------------
CREATE FUNCTION pg_temp.expect(label TEXT, ok BOOLEAN) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF ok IS TRUE THEN RAISE NOTICE 'PASS  %', label;
    ELSE RAISE EXCEPTION 'FAIL  %', label; END IF;
END $$;

-- a valid bcrypt hash for test inserts
\set H '''$2b$12$IrZjxD4X72slxHVXvpLfv.VuqN4nfCBIVNpsVS2bcxHLO9iFD/DaG'''

-- ---------------------------------------------------------------- seed data
SELECT pg_temp.expect('seed: exactly 3 roles',        (SELECT count(*) FROM roles) = 3);
SELECT pg_temp.expect('seed: exactly 9 permissions',  (SELECT count(*) FROM permissions) = 9);
SELECT pg_temp.expect('seed: exactly 10 role-permission mappings', (SELECT count(*) FROM role_permissions) = 10);
SELECT pg_temp.expect('seed: 5 dev users',            (SELECT count(*) FROM users) = 5);
SELECT pg_temp.expect('seed: staff user has a staff row',
    EXISTS (SELECT 1 FROM users u JOIN staff s USING (user_id) WHERE u.email = 'staff@example.com'));
SELECT pg_temp.expect('seed: no customer/admin has a staff row',
    NOT EXISTS (SELECT 1 FROM staff s JOIN users u USING (user_id) JOIN roles r USING (role_id)
                WHERE r.role_name <> 'STAFF'));

-- ------------------------------------------------------------- users: email
SELECT pg_temp.expect_error('users: duplicate email rejected',
    format('INSERT INTO users (role_id,name,email,password_hash) SELECT role_id,%L,%L,%L FROM roles WHERE role_name=%L',
           'Dup', 'customer@example.com', :H, 'CUSTOMER'), '23505');
SELECT pg_temp.expect_error('users: upper-case email rejected (case-insensitive uniqueness)',
    format('INSERT INTO users (role_id,name,email,password_hash) SELECT role_id,%L,%L,%L FROM roles WHERE role_name=%L',
           'Dup', 'Customer@Example.com', :H, 'CUSTOMER'), '23514');
SELECT pg_temp.expect_error('users: email with surrounding spaces rejected',
    format('INSERT INTO users (role_id,name,email,password_hash) SELECT role_id,%L,%L,%L FROM roles WHERE role_name=%L',
           'X', ' new@example.com', :H, 'CUSTOMER'), '23514');
SELECT pg_temp.expect_error('users: malformed email rejected',
    format('INSERT INTO users (role_id,name,email,password_hash) SELECT role_id,%L,%L,%L FROM roles WHERE role_name=%L',
           'X', 'not-an-email', :H, 'CUSTOMER'), '23514');
SELECT pg_temp.expect_error('users: NULL email rejected',
    format('INSERT INTO users (role_id,name,email,password_hash) SELECT role_id,%L,NULL,%L FROM roles WHERE role_name=%L',
           'X', :H, 'CUSTOMER'), '23502');

-- ---------------------------------------------------------- users: other
SELECT pg_temp.expect_error('users: plaintext password rejected',
    format('INSERT INTO users (role_id,name,email,password_hash) SELECT role_id,%L,%L,%L FROM roles WHERE role_name=%L',
           'X', 'p@example.com', 'Railway@Dev123', 'CUSTOMER'), '23514');
SELECT pg_temp.expect_error('users: invalid role_id rejected (FK)',
    format('INSERT INTO users (role_id,name,email,password_hash) VALUES (999999,%L,%L,%L)',
           'X', 'r@example.com', :H), '23503');
SELECT pg_temp.expect_error('users: unknown status rejected (enum)',
    format('UPDATE users SET status = %L WHERE email = %L', 'DISABLED', 'customer@example.com'), '22P02');
SELECT pg_temp.expect_error('users: bad phone rejected',
    format('UPDATE users SET phone = %L WHERE email = %L', '12ab', 'customer@example.com'), '23514');
SELECT pg_temp.expect_error('users: negative failed_login_attempts rejected',
    format('UPDATE users SET failed_login_attempts = -1 WHERE email = %L', 'customer@example.com'), '23514');
SELECT pg_temp.expect_error('users: blank name rejected',
    format('UPDATE users SET name = %L WHERE email = %L', '   ', 'customer@example.com'), '23514');
SELECT pg_temp.expect_error('users: user_id cannot be set by hand (GENERATED ALWAYS)',
    format('INSERT INTO users (user_id,role_id,name,email,password_hash) SELECT 42,role_id,%L,%L,%L FROM roles WHERE role_name=%L',
           'X', 'id@example.com', :H, 'CUSTOMER'), '428C9');

-- defaults for a new customer (what Member 1's registration will rely on)
INSERT INTO users (role_id, name, email, password_hash)
SELECT role_id, 'New Customer', 'new@example.com', :H FROM roles WHERE role_name = 'CUSTOMER';
SELECT pg_temp.expect('users: new user defaults status=ACTIVE, failed_login_attempts=0, last_login_at NULL',
    (SELECT status = 'ACTIVE' AND failed_login_attempts = 0 AND last_login_at IS NULL
            AND created_at IS NOT NULL AND updated_at IS NOT NULL
     FROM users WHERE email = 'new@example.com'));

-- updated_at trigger
UPDATE users SET updated_at = now() - interval '1 day' WHERE email = 'new@example.com';
UPDATE users SET name = 'Renamed' WHERE email = 'new@example.com';
SELECT pg_temp.expect('users: updated_at refreshed on update',
    (SELECT updated_at = now() FROM users WHERE email = 'new@example.com'));

-- ---------------------------------------------------------------- roles
SELECT pg_temp.expect_error('roles: duplicate role rejected',
    'INSERT INTO roles (role_name) VALUES (''ADMIN'')', '23505');
SELECT pg_temp.expect_error('roles: role outside the enum rejected',
    'INSERT INTO roles (role_name) VALUES (''SUPERUSER'')', '22P02');
SELECT pg_temp.expect_error('roles: deleting a role still in use rejected',
    'DELETE FROM roles WHERE role_name = ''CUSTOMER''', '23503');

-- ------------------------------------------------------- permissions / RBAC
SELECT pg_temp.expect_error('permissions: duplicate name rejected',
    'INSERT INTO permissions (permission_name) VALUES (''BOOK_TICKET'')', '23505');
SELECT pg_temp.expect_error('permissions: lower-case name rejected',
    'INSERT INTO permissions (permission_name) VALUES (''book_ticket'')', '23514');
SELECT pg_temp.expect_error('role_permissions: duplicate assignment rejected',
    'INSERT INTO role_permissions SELECT r.role_id, p.permission_id FROM roles r, permissions p
     WHERE r.role_name=''CUSTOMER'' AND p.permission_name=''BOOK_TICKET''', '23505');
SELECT pg_temp.expect_error('role_permissions: unknown permission rejected (FK)',
    'INSERT INTO role_permissions SELECT role_id, 999999 FROM roles WHERE role_name=''ADMIN''', '23503');
SELECT pg_temp.expect_error('role_permissions: unknown role rejected (FK)',
    'INSERT INTO role_permissions SELECT 999999, permission_id FROM permissions WHERE permission_name=''BOOK_TICKET''', '23503');

SELECT pg_temp.expect('view: customer CAN book',
    EXISTS (SELECT 1 FROM user_permissions v JOIN users u USING (user_id)
            WHERE u.email='customer@example.com' AND v.permission_name='BOOK_TICKET'));
SELECT pg_temp.expect('view: customer can NOT manage users',
    NOT EXISTS (SELECT 1 FROM user_permissions v JOIN users u USING (user_id)
                WHERE u.email='customer@example.com' AND v.permission_name='MANAGE_USERS'));
SELECT pg_temp.expect('view: staff can view passengers but not book',
    EXISTS (SELECT 1 FROM user_permissions v JOIN users u USING (user_id)
            WHERE u.email='staff@example.com' AND v.permission_name='VIEW_PASSENGER')
    AND NOT EXISTS (SELECT 1 FROM user_permissions v JOIN users u USING (user_id)
            WHERE u.email='staff@example.com' AND v.permission_name='BOOK_TICKET'));
SELECT pg_temp.expect('view: admin has all 6 admin permissions',
    (SELECT count(*) FROM user_permissions v JOIN users u USING (user_id)
     WHERE u.email='admin@example.com') = 6);
SELECT pg_temp.expect('view: exposes status so locked users can be denied',
    (SELECT DISTINCT v.status FROM user_permissions v JOIN users u USING (user_id)
     WHERE u.email='locked@example.com') = 'LOCKED');

-- ----------------------------------------------------------------- staff
SELECT pg_temp.expect_error('staff: row for a CUSTOMER rejected',
    'INSERT INTO staff (user_id,department,location)
     SELECT user_id,''Ops'',''NDLS'' FROM users WHERE email=''customer@example.com''', '23514');
SELECT pg_temp.expect_error('staff: row for an ADMIN rejected',
    'INSERT INTO staff (user_id,department,location)
     SELECT user_id,''Ops'',''NDLS'' FROM users WHERE email=''admin@example.com''', '23514');
SELECT pg_temp.expect_error('staff: second row for same user rejected',
    'INSERT INTO staff (user_id,department,location)
     SELECT user_id,''Ops'',''NDLS'' FROM users WHERE email=''staff@example.com''', '23505');
SELECT pg_temp.expect_error('staff: row for non-existent user rejected (FK)',
    'INSERT INTO staff (user_id,department,location) VALUES (999999,''Ops'',''NDLS'')', '23503');
SELECT pg_temp.expect_error('staff: cannot move a staff user to CUSTOMER while staff row exists',
    'UPDATE users SET role_id=(SELECT role_id FROM roles WHERE role_name=''CUSTOMER'')
     WHERE email=''staff@example.com''', '23514');

-- create_staff_user: success path
SELECT * FROM create_staff_user('Ops Person','OPS@Example.com','9876543210',:H,'Operations','CSMT');
SELECT pg_temp.expect('create_staff_user: creates user (role STAFF) + linked staff row',
    EXISTS (SELECT 1 FROM users u JOIN staff s USING (user_id) JOIN roles r USING (role_id)
            WHERE u.email='ops@example.com' AND r.role_name='STAFF'
              AND s.department='Operations' AND s.location='CSMT'));
SELECT pg_temp.expect('create_staff_user: email normalised to lower case',
    EXISTS (SELECT 1 FROM users WHERE email='ops@example.com'));

-- create_staff_user: atomicity. Blank department fails the staff insert;
-- the user insert that ran before it must be undone too.
SAVEPOINT before_bad_staff;
SELECT pg_temp.expect_error('create_staff_user: blank department rejected',
    format('SELECT * FROM create_staff_user(%L,%L,NULL,%L,%L,%L)',
           'Half Made','half@example.com', :H, '  ', 'NDLS'), '23514');
SELECT pg_temp.expect('create_staff_user: failed call leaves NO orphan user',
    NOT EXISTS (SELECT 1 FROM users WHERE email='half@example.com'));
SELECT pg_temp.expect_error('create_staff_user: duplicate email rejected',
    format('SELECT * FROM create_staff_user(%L,%L,NULL,%L,%L,%L)',
           'Dup','staff@example.com', :H, 'Ops', 'NDLS'), '23505');

-- deleting a staff user removes the staff row
DELETE FROM users WHERE email='ops@example.com';
SELECT pg_temp.expect('staff: deleting the user cascades to the staff row',
    (SELECT count(*) FROM staff) = 1);

-- ------------------------------------------------------- token tables
SELECT pg_temp.expect_error('refresh_tokens: raw (non-hash) token rejected',
    'INSERT INTO refresh_tokens (user_id,token_hash,expires_at)
     SELECT user_id, rpad(''eyJhbGciOi'',64,''x''), now()+interval ''7 days'' FROM users WHERE email=''customer@example.com''', '23514');
SELECT pg_temp.expect_error('refresh_tokens: expiry before creation rejected',
    'INSERT INTO refresh_tokens (user_id,token_hash,expires_at)
     SELECT user_id, encode(sha256(''t1''),''hex''), now()-interval ''1 day'' FROM users WHERE email=''customer@example.com''', '23514');
INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
SELECT user_id, encode(sha256('t1'), 'hex'), now() + interval '7 days' FROM users WHERE email='customer@example.com';
SELECT pg_temp.expect_error('refresh_tokens: duplicate hash rejected',
    'INSERT INTO refresh_tokens (user_id,token_hash,expires_at)
     SELECT user_id, encode(sha256(''t1''),''hex''), now()+interval ''7 days'' FROM users WHERE email=''admin@example.com''', '23505');
SELECT pg_temp.expect_error('password_reset_tokens: raw token rejected',
    'INSERT INTO password_reset_tokens (user_id,token_hash,expires_at)
     SELECT user_id, ''abc'', now()+interval ''1 hour'' FROM users WHERE email=''customer@example.com''', '23514');
DELETE FROM users WHERE email = 'customer@example.com';
SELECT pg_temp.expect('tokens: deleting a user deletes their tokens',
    (SELECT count(*) FROM refresh_tokens) = 0);

ROLLBACK;
\echo ALL SQL TESTS PASSED
