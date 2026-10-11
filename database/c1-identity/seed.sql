-- =====================================================================
-- C1 seed — roles, permissions and the role→permission matrix
-- Safe to run in any environment. Idempotent: re-running gives the same
-- result and never creates duplicates.
--
-- Run after schema.sql:  psql -d railway -v ON_ERROR_STOP=1 -f seed.sql
--
-- The matrix below is the SINGLE SOURCE OF TRUTH. Re-running this file
-- also REMOVES any role_permissions row that isn't in it, so the database
-- always equals this file. Change the matrix here, not by hand in the DB.
--
-- STATUS: DRAFT matrix. Permission names come from the team plan and the
-- master schema note ("BOOK_TICKET, CANCEL_OWN_BOOKING, MANAGE_USERS").
-- Must be confirmed with the C2 (trains), C4 (booking) and C5 (payments)
-- teams so it matches operations they actually build.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Roles (values fixed by role_name_enum)
-- ---------------------------------------------------------------------
INSERT INTO roles (role_name, description) VALUES
    ('CUSTOMER', 'Passenger or traveller who books tickets for themselves (self-service).'),
    ('STAFF',    'Authorised railway employee; has a matching row in staff.'),
    ('ADMIN',    'System administrator; manages users, staff, roles and master data.')
ON CONFLICT (role_name) DO UPDATE
    SET description = EXCLUDED.description;

-- ---------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------
INSERT INTO permissions (permission_name, description) VALUES
    ('BOOK_TICKET',        'Create a booking for oneself.'),
    ('VIEW_OWN_BOOKING',   'View bookings where booking.user_id = the caller.'),
    ('CANCEL_OWN_BOOKING', 'Cancel passengers on one''s own booking.'),
    ('VIEW_PASSENGER',     'View passenger and booking details of other users (operations / support).'),
    ('MANAGE_USERS',       'Create, update, lock/suspend and change roles of user accounts.'),
    ('MANAGE_STAFF',       'Create and update staff accounts and staff records.'),
    ('MANAGE_ROLES',       'Change which permissions each role has.'),
    ('MANAGE_MASTER_DATA', 'Maintain trains, stations, routes, classes, quotas and fares.'),
    ('VIEW_AUDIT_LOG',     'Read security audit events.')
ON CONFLICT (permission_name) DO UPDATE
    SET description = EXCLUDED.description;

-- ---------------------------------------------------------------------
-- Role → permission matrix (DRAFT — see header)
--
--                       CUSTOMER  STAFF  ADMIN
--   BOOK_TICKET            ✔
--   VIEW_OWN_BOOKING       ✔
--   CANCEL_OWN_BOOKING     ✔
--   VIEW_PASSENGER                  ✔      ✔
--   MANAGE_USERS                           ✔
--   MANAGE_STAFF                           ✔
--   MANAGE_ROLES                           ✔
--   MANAGE_MASTER_DATA                     ✔
--   VIEW_AUDIT_LOG                         ✔
--
-- Booking permissions are CUSTOMER-only because the master schema says
-- bookings are "Self-service only: user_id is the customer."
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _matrix (role_name role_name_enum, permission_name VARCHAR) ON COMMIT DROP;
INSERT INTO _matrix VALUES
    ('CUSTOMER', 'BOOK_TICKET'),
    ('CUSTOMER', 'VIEW_OWN_BOOKING'),
    ('CUSTOMER', 'CANCEL_OWN_BOOKING'),
    ('STAFF',    'VIEW_PASSENGER'),
    ('ADMIN',    'VIEW_PASSENGER'),
    ('ADMIN',    'MANAGE_USERS'),
    ('ADMIN',    'MANAGE_STAFF'),
    ('ADMIN',    'MANAGE_ROLES'),
    ('ADMIN',    'MANAGE_MASTER_DATA'),
    ('ADMIN',    'VIEW_AUDIT_LOG');

-- Fail loudly if the matrix names a permission that doesn't exist
DO $$
DECLARE missing TEXT;
BEGIN
    SELECT string_agg(m.permission_name, ', ') INTO missing
    FROM _matrix m LEFT JOIN permissions p USING (permission_name)
    WHERE p.permission_id IS NULL;
    IF missing IS NOT NULL THEN
        RAISE EXCEPTION 'matrix references unknown permission(s): %', missing;
    END IF;
END $$;

-- Remove mappings that are no longer in the matrix
DELETE FROM role_permissions rp
WHERE NOT EXISTS (
    SELECT 1
    FROM _matrix m
    JOIN roles r       ON r.role_name = m.role_name
    JOIN permissions p ON p.permission_name = m.permission_name
    WHERE r.role_id = rp.role_id AND p.permission_id = rp.permission_id
);

-- Add mappings that are missing
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM _matrix m
JOIN roles r       ON r.role_name = m.role_name
JOIN permissions p ON p.permission_name = m.permission_name
ON CONFLICT DO NOTHING;

COMMIT;
