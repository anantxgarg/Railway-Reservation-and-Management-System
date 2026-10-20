-- =====================================================================
-- C1 DEVELOPMENT-ONLY test accounts. NEVER run in production.
--
-- Every account's password is:   Railway@Dev123
-- Hashes are bcrypt ($2b$, cost 12), generated with Python bcrypt 4.x
-- and verified to match the password above. Member 1's bcrypt library
-- (Node bcrypt/bcryptjs, Python bcrypt, Spring BCryptPasswordEncoder)
-- verifies $2b$ hashes.
--
-- Run after schema.sql and seed.sql:
--   psql -d railway -v ON_ERROR_STOP=1 -f seed_dev_users.sql
-- Idempotent: existing accounts (matched by e-mail) are left untouched.
-- example.com is reserved for testing (RFC 2606), so no real inbox exists.
-- =====================================================================

BEGIN;

INSERT INTO users (role_id, name, email, phone, password_hash, status)
SELECT r.role_id, v.name, v.email, v.phone, v.password_hash, v.status::user_status_enum
FROM (VALUES
    -- Normal customer
    ('CUSTOMER', 'Test Customer',  'customer@example.com',  '+919000000001',
     '$2b$12$IrZjxD4X72slxHVXvpLfv.VuqN4nfCBIVNpsVS2bcxHLO9iFD/DaG', 'ACTIVE'),
    -- Administrator
    ('ADMIN',    'Test Admin',     'admin@example.com',     '+919000000003',
     '$2b$12$vI9O6E6XEKPLshnc/sESEuR3nMJ2DpEqb8KozC1UbczRMO2lzQ8Rq', 'ACTIVE'),
    -- For Member 1's "locked account must not log in" test
    ('CUSTOMER', 'Locked Customer',    'locked@example.com',    '+919000000004',
     '$2b$12$Rs2stAj/ImTdweF6pz45ReLNoDVWzXFvIM6nOvcdfrZqKLk5bY9EC', 'LOCKED'),
    -- For Member 1's "suspended account must not log in" test
    ('CUSTOMER', 'Suspended Customer', 'suspended@example.com', '+919000000005',
     '$2b$12$nRGbGoITaPGwTMzRhdE2LOLL0HJDWV/P/YGKrLzhIQ0KzMFTKDIVu', 'SUSPENDED')
) AS v(role_name, name, email, phone, password_hash, status)
JOIN roles r ON r.role_name = v.role_name::role_name_enum
ON CONFLICT (email) DO NOTHING;

-- Staff account goes through the atomic function (user + staff row together)
SELECT create_staff_user(
    'Test Staff', 'staff@example.com', '+919000000002',
    '$2b$12$LvToMMemlFRqyuRLYLq5VeNZbjgzOhG1UIB7MQsMAWXNSb7ST.jNC',
    'Reservations', 'NDLS'
)
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'staff@example.com');

COMMIT;
