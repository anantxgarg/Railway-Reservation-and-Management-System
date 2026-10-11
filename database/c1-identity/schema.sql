-- =====================================================================
-- C1: Identity and Access — PostgreSQL schema
-- Railway Reservation & Management System
-- Source of truth: schema_relational.dbml, section "C1. IDENTITY AND ACCESS"
--   tables: roles, permissions, role_permissions, users, staff
-- (audit_log is a MongoDB collection per schema_mongodb.dbml → see
--  mongo/audit_log.js; it is deliberately NOT created here.)
--
-- Target: PostgreSQL 14+ (tested on 16.15)
-- Owner: Member 2 (Database, User Management & RBAC)
--
-- Run:  psql -d railway -v ON_ERROR_STOP=1 -f schema.sql
-- Drops and recreates the C1 objects, so it is safe to re-run in
-- development. NEVER run it against a database holding real data.
-- NOTE: DROP ... CASCADE will also drop other teams' foreign keys that
-- point at users (e.g. booking.user_id). In a shared DB, run this first,
-- then the other modules' scripts.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Clean slate (children first)
-- ---------------------------------------------------------------------
DROP VIEW     IF EXISTS user_permissions CASCADE;
DROP FUNCTION IF EXISTS create_staff_user(VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR) CASCADE;
DROP TABLE    IF EXISTS staff            CASCADE;
DROP TABLE    IF EXISTS role_permissions CASCADE;
DROP TABLE    IF EXISTS users            CASCADE;
DROP TABLE    IF EXISTS permissions      CASCADE;
DROP TABLE    IF EXISTS roles            CASCADE;
DROP FUNCTION IF EXISTS set_updated_at()               CASCADE;
DROP FUNCTION IF EXISTS check_staff_user_role()        CASCADE;
DROP FUNCTION IF EXISTS check_role_change_with_staff() CASCADE;
DROP TYPE     IF EXISTS role_name_enum   CASCADE;
DROP TYPE     IF EXISTS user_status_enum CASCADE;

-- ---------------------------------------------------------------------
-- Enums — exactly as defined in schema_relational.dbml
-- ---------------------------------------------------------------------
CREATE TYPE role_name_enum   AS ENUM ('CUSTOMER', 'STAFF', 'ADMIN');
CREATE TYPE user_status_enum AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED', 'LOCKED');

-- ---------------------------------------------------------------------
-- 1. roles
-- ---------------------------------------------------------------------
CREATE TABLE roles (
    role_id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_name   role_name_enum NOT NULL,
    description TEXT,
    created_at  TIMESTAMP      NOT NULL DEFAULT now(),

    CONSTRAINT uq_roles_role_name UNIQUE (role_name)
);

-- ---------------------------------------------------------------------
-- 2. permissions
-- ---------------------------------------------------------------------
CREATE TABLE permissions (
    permission_id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    permission_name VARCHAR(100) NOT NULL,
    description     TEXT,

    CONSTRAINT uq_permissions_name     UNIQUE (permission_name),
    -- Upper-snake-case identifiers, e.g. BOOK_TICKET, MANAGE_USERS
    CONSTRAINT ck_permissions_name_fmt CHECK (permission_name ~ '^[A-Z][A-Z_]*$')
);

-- ---------------------------------------------------------------------
-- 3. role_permissions (M:N associative entity)
-- ---------------------------------------------------------------------
CREATE TABLE role_permissions (
    role_id       INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,

    CONSTRAINT pk_role_permissions PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_rp_role
        FOREIGN KEY (role_id) REFERENCES roles (role_id) ON DELETE CASCADE,
    CONSTRAINT fk_rp_permission
        FOREIGN KEY (permission_id) REFERENCES permissions (permission_id) ON DELETE CASCADE
);

-- PK covers lookups by role_id; this covers "which roles grant permission X"
CREATE INDEX ix_rp_permission_id ON role_permissions (permission_id);

-- ---------------------------------------------------------------------
-- 4. users
-- ---------------------------------------------------------------------
CREATE TABLE users (
    user_id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_id               INTEGER          NOT NULL,
    name                  VARCHAR(100)     NOT NULL,
    email                 VARCHAR(255)     NOT NULL,
    phone                 VARCHAR(20),
    password_hash         VARCHAR(255)     NOT NULL,
    -- OPEN DECISION: default ACTIVE assumes no e-mail verification step.
    -- If registration must verify e-mail first, change default to PENDING.
    status                user_status_enum NOT NULL DEFAULT 'ACTIVE',
    created_at            TIMESTAMP        NOT NULL DEFAULT now(),
    updated_at            TIMESTAMP        NOT NULL DEFAULT now(),
    last_login_at         TIMESTAMP,
    failed_login_attempts INTEGER          NOT NULL DEFAULT 0,

    -- Deleting a role that still has users is refused
    CONSTRAINT fk_users_role
        FOREIGN KEY (role_id) REFERENCES roles (role_id) ON DELETE RESTRICT,

    -- Case-insensitive uniqueness: the DB only accepts lower-case,
    -- trimmed e-mails, so plain UNIQUE is effectively case-insensitive.
    -- Member 1 MUST do lower(trim(email)) before INSERT and before lookup.
    CONSTRAINT uq_users_email          UNIQUE (email),
    CONSTRAINT ck_users_email_lower    CHECK (email = lower(btrim(email))),
    CONSTRAINT ck_users_email_fmt      CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),

    CONSTRAINT ck_users_name_not_blank CHECK (btrim(name) <> ''),
    -- Optional leading +, then 10–15 digits (e.g. +919876543210, 9876543210)
    CONSTRAINT ck_users_phone_fmt      CHECK (phone IS NULL OR phone ~ '^\+?[0-9]{10,15}$'),
    CONSTRAINT ck_users_failed_nonneg  CHECK (failed_login_attempts >= 0),

    -- bcrypt hashes are exactly 60 chars: $2a$/$2b$/$2y$ + cost + 53 chars.
    -- Makes it impossible to store a plaintext password by mistake.
    CONSTRAINT ck_users_pw_is_bcrypt   CHECK (password_hash ~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$')
);

CREATE INDEX ix_users_role_id ON users (role_id);

-- ---------------------------------------------------------------------
-- 5. staff (users 1 : 0..1 staff)
-- ---------------------------------------------------------------------
CREATE TABLE staff (
    staff_id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    INTEGER      NOT NULL,
    department VARCHAR(100) NOT NULL,
    -- varchar per the master schema. Could later reference
    -- station.station_code (C2) — needs agreement with the C2 team.
    location   VARCHAR(150) NOT NULL,

    CONSTRAINT uq_staff_user_id UNIQUE (user_id),
    CONSTRAINT fk_staff_user
        FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT ck_staff_department_not_blank CHECK (btrim(department) <> ''),
    CONSTRAINT ck_staff_location_not_blank   CHECK (btrim(location) <> '')
);

-- =====================================================================
-- Triggers & functions
-- =====================================================================

-- Keep users.updated_at current -------------------------------------------
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Master schema rule: "A [staff] row may exist only for a user whose role
-- is STAFF (trigger or check)." ---------------------------------------------
CREATE FUNCTION check_staff_user_role() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_role role_name_enum;
BEGIN
    SELECT r.role_name INTO v_role
    FROM users u JOIN roles r ON r.role_id = u.role_id
    WHERE u.user_id = NEW.user_id;

    -- A missing user is left for the foreign key to report
    IF v_role IS NOT NULL AND v_role <> 'STAFF' THEN
        RAISE EXCEPTION 'staff record requires a user with role STAFF (user % has role %)',
            NEW.user_id, v_role
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_staff_role_check
    BEFORE INSERT OR UPDATE OF user_id ON staff
    FOR EACH ROW EXECUTE FUNCTION check_staff_user_role();

-- Same rule from the other side: a user with a staff row can't be moved
-- off the STAFF role (delete the staff row first, deliberately). ---------
CREATE FUNCTION check_role_change_with_staff() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.role_id IS DISTINCT FROM OLD.role_id
       AND EXISTS (SELECT 1 FROM staff s WHERE s.user_id = NEW.user_id)
       AND (SELECT role_name FROM roles WHERE role_id = NEW.role_id) <> 'STAFF'
    THEN
        RAISE EXCEPTION 'user % has a staff record; remove it before changing role away from STAFF',
            NEW.user_id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_role_change
    BEFORE UPDATE OF role_id ON users
    FOR EACH ROW EXECUTE FUNCTION check_role_change_with_staff();

-- Atomic staff-account creation ---------------------------------------------
-- Creates the STAFF user and its staff row in ONE call. The function runs
-- inside the caller's transaction, so if either insert fails, neither row
-- is kept. p_password_hash must already be a bcrypt hash (Member 1 hashes).
--   SELECT * FROM create_staff_user('Name','a@b.in','9876543210',
--                                   '$2b$12$...','Operations','NDLS');
CREATE FUNCTION create_staff_user(
    p_name          VARCHAR,
    p_email         VARCHAR,
    p_phone         VARCHAR,
    p_password_hash VARCHAR,
    p_department    VARCHAR,
    p_location      VARCHAR
) RETURNS TABLE (user_id INTEGER, staff_id INTEGER)
LANGUAGE plpgsql AS $$
DECLARE
    v_role_id  INTEGER;
    v_user_id  INTEGER;
    v_staff_id INTEGER;
BEGIN
    SELECT r.role_id INTO v_role_id FROM roles r WHERE r.role_name = 'STAFF';
    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'role STAFF is not seeded' USING ERRCODE = 'foreign_key_violation';
    END IF;

    INSERT INTO users (role_id, name, email, phone, password_hash)
    VALUES (v_role_id, p_name, lower(btrim(p_email)), p_phone, p_password_hash)
    RETURNING users.user_id INTO v_user_id;

    INSERT INTO staff (user_id, department, location)
    VALUES (v_user_id, p_department, p_location)
    RETURNING staff.staff_id INTO v_staff_id;

    RETURN QUERY SELECT v_user_id, v_staff_id;
END;
$$;

-- =====================================================================
-- Read model for authorization checks (used by Member 1's middleware)
--   SELECT 1 FROM user_permissions
--   WHERE user_id = $1 AND permission_name = $2 AND status = 'ACTIVE';
-- =====================================================================
CREATE VIEW user_permissions AS
SELECT u.user_id,
       u.status,
       r.role_name,
       p.permission_name
FROM users u
JOIN roles r             ON r.role_id = u.role_id
JOIN role_permissions rp ON rp.role_id = r.role_id
JOIN permissions p       ON p.permission_id = rp.permission_id;

COMMIT;
