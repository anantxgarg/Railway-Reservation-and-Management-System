-- Migration: V20250101_0002__identity_and_access.sql
-- Description: Create Identity & Access module tables (5 tables)
-- Tables: roles, permissions, role_permissions, users, staff
-- Date: 2025-01-01
-- Author: Railway Reservation System Team

-- =====================================================================
-- IDENTITY & ACCESS MODULE (5 TABLES)
-- =====================================================================
-- This module handles authentication, authorization, and user management
-- Dependencies: role_name_enum, user_status_enum (from previous migration)

-- ---------------------------------------------------------------------
-- TABLE: roles
-- Purpose: System roles (CUSTOMER, STAFF, ADMIN)
-- ---------------------------------------------------------------------
CREATE TABLE roles (
    role_id SERIAL PRIMARY KEY,
    role_name role_name_enum NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE roles IS 'System roles: CUSTOMER, STAFF, ADMIN';
COMMENT ON COLUMN roles.role_id IS 'Primary key';
COMMENT ON COLUMN roles.role_name IS 'Role name from enum (CUSTOMER/STAFF/ADMIN)';
COMMENT ON COLUMN roles.description IS 'Role description and purpose';
COMMENT ON COLUMN roles.created_at IS 'Timestamp when role was created';

-- ---------------------------------------------------------------------
-- TABLE: permissions
-- Purpose: Atomic permissions that can be assigned to roles
-- ---------------------------------------------------------------------
CREATE TABLE permissions (
    permission_id SERIAL PRIMARY KEY,
    permission_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE permissions IS 'Atomic permissions (e.g., BOOK_TICKET, CANCEL_OWN_BOOKING, MANAGE_USERS)';
COMMENT ON COLUMN permissions.permission_id IS 'Primary key';
COMMENT ON COLUMN permissions.permission_name IS 'Unique permission identifier';
COMMENT ON COLUMN permissions.description IS 'What this permission allows';

-- ---------------------------------------------------------------------
-- TABLE: role_permissions
-- Purpose: Many-to-many mapping between roles and permissions
-- ---------------------------------------------------------------------
CREATE TABLE role_permissions (
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Composite primary key
    PRIMARY KEY (role_id, permission_id),
    
    -- Foreign keys with cascading delete (if role or permission deleted, mapping deleted)
    CONSTRAINT fk_role_permissions_role 
        FOREIGN KEY (role_id) 
        REFERENCES roles(role_id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_role_permissions_permission 
        FOREIGN KEY (permission_id) 
        REFERENCES permissions(permission_id) 
        ON DELETE CASCADE
);

COMMENT ON TABLE role_permissions IS 'Many-to-many mapping of roles to permissions';
COMMENT ON COLUMN role_permissions.role_id IS 'Reference to role';
COMMENT ON COLUMN role_permissions.permission_id IS 'Reference to permission';
COMMENT ON COLUMN role_permissions.granted_at IS 'When permission was granted to role';

-- Create indexes for foreign key lookups
CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);

-- ---------------------------------------------------------------------
-- TABLE: users
-- Purpose: All system users (customers, staff, admins)
-- ---------------------------------------------------------------------
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    status user_status_enum NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    
    -- Foreign key to roles (restrict deletion if users exist with that role)
    CONSTRAINT fk_users_role 
        FOREIGN KEY (role_id) 
        REFERENCES roles(role_id) 
        ON DELETE RESTRICT,
    
    -- Check constraints
    CONSTRAINT chk_users_email_format 
        CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    
    CONSTRAINT chk_users_failed_attempts 
        CHECK (failed_login_attempts >= 0)
);

COMMENT ON TABLE users IS 'All system users with authentication and authorization';
COMMENT ON COLUMN users.user_id IS 'Primary key';
COMMENT ON COLUMN users.role_id IS 'User role (CUSTOMER/STAFF/ADMIN)';
COMMENT ON COLUMN users.name IS 'Full name';
COMMENT ON COLUMN users.email IS 'Email address (unique, used for login)';
COMMENT ON COLUMN users.phone IS 'Contact phone number';
COMMENT ON COLUMN users.password_hash IS 'Hashed password (BCrypt recommended)';
COMMENT ON COLUMN users.status IS 'Account status (ACTIVE/INACTIVE/PENDING/SUSPENDED/LOCKED)';
COMMENT ON COLUMN users.created_at IS 'Account creation timestamp';
COMMENT ON COLUMN users.updated_at IS 'Last update timestamp';
COMMENT ON COLUMN users.last_login_at IS 'Last successful login';
COMMENT ON COLUMN users.failed_login_attempts IS 'Count of consecutive failed login attempts';

-- Create indexes for common queries
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);

-- ---------------------------------------------------------------------
-- TABLE: staff
-- Purpose: Additional information for staff users
-- Relationship: users 1:0..1 staff (specialization)
-- ---------------------------------------------------------------------
CREATE TABLE staff (
    staff_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    department VARCHAR(100) NOT NULL,
    location VARCHAR(100) NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key to users (cascade delete: if user deleted, staff record deleted)
    CONSTRAINT fk_staff_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(user_id) 
        ON DELETE CASCADE
);

COMMENT ON TABLE staff IS 'Staff-specific information (specialization of users)';
COMMENT ON COLUMN staff.staff_id IS 'Primary key';
COMMENT ON COLUMN staff.user_id IS 'Reference to user (must be STAFF role)';
COMMENT ON COLUMN staff.department IS 'Department (e.g., Operations, Customer Service)';
COMMENT ON COLUMN staff.location IS 'Work location/station';
COMMENT ON COLUMN staff.joined_at IS 'Staff joining date';

-- Create index for user lookup
CREATE INDEX idx_staff_user_id ON staff(user_id);

-- =====================================================================
-- TRIGGER: Auto-update updated_at timestamp
-- =====================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON FUNCTION update_updated_at_column() IS 'Automatically updates updated_at timestamp on row update';

-- =====================================================================
-- VERIFICATION
-- =====================================================================
DO $$
DECLARE
    table_count INTEGER;
    rec RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== Identity & Access Module Created ===';
    RAISE NOTICE '';
    
    -- Count tables created
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('roles', 'permissions', 'role_permissions', 'users', 'staff');
    
    RAISE NOTICE 'Tables created: %', table_count;
    RAISE NOTICE '';
    
    -- List tables with row counts
    FOR rec IN
        SELECT 
            table_name,
            (SELECT COUNT(*) FROM roles WHERE table_name = 'roles') as row_count
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('roles', 'permissions', 'role_permissions', 'users', 'staff')
        ORDER BY table_name
    LOOP
        RAISE NOTICE '  - %', rec.table_name;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE 'Module: Identity & Access';
    RAISE NOTICE 'Status: ✓ Complete';
    RAISE NOTICE '';
END $$;
