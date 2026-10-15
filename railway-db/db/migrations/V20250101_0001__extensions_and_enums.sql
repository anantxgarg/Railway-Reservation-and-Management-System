-- Migration: V20250101_0001__extensions_and_enums.sql
-- Description: Install PostgreSQL extensions and create all enum types
-- Date: 2025-01-01
-- Author: Railway Reservation System Team

-- =====================================================================
-- EXTENSIONS
-- =====================================================================

-- btree_gist: Required for exclusion constraints on seat allocation
-- This will be used to prevent double-booking of seats on overlapping journey segments
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- =====================================================================
-- ENUM TYPES
-- =====================================================================
-- All enumerated types used throughout the schema
-- Organized by module for clarity

-- ---------------------------------------------------------------------
-- Identity & Access Module Enums
-- ---------------------------------------------------------------------

-- System roles: Three primary user roles
CREATE TYPE role_name_enum AS ENUM (
    'CUSTOMER',  -- Regular users who book tickets
    'STAFF',     -- Railway staff with operational access
    'ADMIN'      -- System administrators with full access
);

-- User account status
CREATE TYPE user_status_enum AS ENUM (
    'ACTIVE',     -- Account is active and can be used
    'INACTIVE',   -- Account is deactivated
    'PENDING',    -- Account pending activation/verification
    'SUSPENDED',  -- Account temporarily suspended
    'LOCKED'      -- Account locked (e.g., too many failed login attempts)
);

-- ---------------------------------------------------------------------
-- Trains, Stations & Routes Module Enums
-- ---------------------------------------------------------------------

-- Train types/categories
CREATE TYPE train_type_enum AS ENUM (
    'Express',     -- Express trains (fewer stops)
    'Slow',        -- Passenger/slow trains (more stops)
    'High-Speed'   -- High-speed rail services
);

-- ---------------------------------------------------------------------
-- Fares Module Enums
-- ---------------------------------------------------------------------

-- Booking quota categories
CREATE TYPE quota_name_enum AS ENUM (
    'General',  -- General quota (default)
    'Tatkal',   -- Last-minute booking quota (higher fare)
    'Ladies',   -- Ladies quota
    'Senior'    -- Senior citizen quota
);

-- ---------------------------------------------------------------------
-- Booking Module Enums
-- ---------------------------------------------------------------------

-- Booking status lifecycle
CREATE TYPE booking_status_enum AS ENUM (
    'HELD',      -- Booking created, payment pending (temporary hold on seats)
    'CONFIRMED', -- Payment successful, booking confirmed
    'CANCELLED', -- Booking cancelled by user or system
    'EXPIRED'    -- Booking expired (payment not completed in time)
);

-- Passenger status on a booking
CREATE TYPE passenger_status_enum AS ENUM (
    'CONFIRMED', -- Passenger has confirmed seat allocation
    'RAC',       -- Reservation Against Cancellation (shared berth)
    'WAITLIST',  -- On waitlist, no seat allocated yet
    'CANCELLED'  -- Passenger cancelled from the booking
);

-- ---------------------------------------------------------------------
-- Payments & Refunds Module Enums
-- ---------------------------------------------------------------------

-- Payment gateway providers
CREATE TYPE payment_provider_enum AS ENUM (
    'RAZORPAY'  -- Using Razorpay as the payment gateway
);

-- Overall payment status
CREATE TYPE payment_status_enum AS ENUM (
    'CREATED',        -- Payment order created, not yet paid
    'PENDING',        -- Payment initiated, awaiting completion
    'SUCCESS',        -- Payment completed successfully
    'FAILED',         -- Payment failed
    'REFUNDED',       -- Fully refunded
    'PARTIAL_REFUND'  -- Partially refunded (some passengers cancelled)
);

-- Payment method used by customer
CREATE TYPE payment_method_enum AS ENUM (
    'CARD',       -- Credit/Debit card
    'UPI',        -- Unified Payments Interface
    'NETBANKING', -- Internet banking
    'WALLET'      -- Digital wallet
);

-- Individual transaction type (currently only PAYMENT)
CREATE TYPE transaction_type_enum AS ENUM (
    'PAYMENT'  -- Payment transaction (retries handled as separate transactions)
);

-- Individual transaction status
CREATE TYPE transaction_status_enum AS ENUM (
    'INITIATED', -- Transaction initiated with gateway
    'SUCCESS',   -- Transaction completed successfully
    'FAILED'     -- Transaction failed
);

-- Refund processing status
CREATE TYPE refund_status_enum AS ENUM (
    'INITIATED',  -- Refund initiated
    'PROCESSING', -- Refund being processed by gateway
    'SUCCESS',    -- Refund completed successfully
    'FAILED'      -- Refund failed
);

-- =====================================================================
-- VERIFICATION
-- =====================================================================

-- Display all created enums for verification
DO $$
DECLARE
    enum_record RECORD;
    enum_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== Created Enum Types ===';
    
    FOR enum_record IN 
        SELECT 
            t.typname as enum_name,
            array_agg(e.enumlabel ORDER BY e.enumsortorder) as values
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname LIKE '%_enum'
        GROUP BY t.typname
        ORDER BY t.typname
    LOOP
        enum_count := enum_count + 1;
        RAISE NOTICE '% - %: %', 
            enum_count, 
            enum_record.enum_name, 
            array_to_string(enum_record.values, ', ');
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE 'Total enums created: %', enum_count;
    RAISE NOTICE '';
END $$;
