-- Migration: V20250101_0004__fares.sql
-- Description: Create Fares module tables (2 tables)
-- Tables: quota, concession_rule
-- Date: 2025-01-01
-- Author: Railway Reservation System Team

-- =====================================================================
-- FARES MODULE (2 TABLES)
-- =====================================================================
-- This module handles pricing rules, quotas, and concessions
-- Dependencies: quota_name_enum (from previous migration)

-- ---------------------------------------------------------------------
-- TABLE: quota
-- Purpose: Booking allocation categories with fare multipliers
-- Key: Natural key (quota_code)
-- ---------------------------------------------------------------------
CREATE TABLE quota (
    quota_code VARCHAR(10) PRIMARY KEY,
    quota_name quota_name_enum NOT NULL UNIQUE,
    fare_multiplier NUMERIC(5,2) NOT NULL DEFAULT 1.00,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_quota_fare_multiplier 
        CHECK (fare_multiplier > 0)
);

COMMENT ON TABLE quota IS 'Booking allocation categories (General, Tatkal, Ladies, Senior)';
COMMENT ON COLUMN quota.quota_code IS 'Unique quota code (e.g., GEN, TKL, LDI, SNR)';
COMMENT ON COLUMN quota.quota_name IS 'Quota name from enum';
COMMENT ON COLUMN quota.fare_multiplier IS 'Fare multiplier (e.g., 1.0 for General, 1.3 for Tatkal)';
COMMENT ON COLUMN quota.description IS 'Quota description and rules';

-- ---------------------------------------------------------------------
-- TABLE: concession_rule
-- Purpose: Fare discount rules for specific passenger categories
-- ---------------------------------------------------------------------
CREATE TABLE concession_rule (
    concession_id SERIAL PRIMARY KEY,
    concession_name VARCHAR(100) NOT NULL UNIQUE,
    eligibility_rule TEXT NOT NULL,
    discount_type VARCHAR(50) NOT NULL,
    discount_value NUMERIC(10,2) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_concession_discount_value 
        CHECK (discount_value >= 0),
    
    CONSTRAINT chk_concession_discount_type 
        CHECK (discount_type IN ('PERCENTAGE', 'FIXED_AMOUNT'))
);

COMMENT ON TABLE concession_rule IS 'Passenger-specific fare discounts (e.g., Senior Citizen, Child, Disabled)';
COMMENT ON COLUMN concession_rule.concession_id IS 'Primary key';
COMMENT ON COLUMN concession_rule.concession_name IS 'Unique concession name (e.g., Senior Citizen, Child)';
COMMENT ON COLUMN concession_rule.eligibility_rule IS 'Eligibility criteria (text description or JSON)';
COMMENT ON COLUMN concession_rule.discount_type IS 'Type of discount: PERCENTAGE or FIXED_AMOUNT';
COMMENT ON COLUMN concession_rule.discount_value IS 'Discount value (percentage 0-100 or fixed amount)';
COMMENT ON COLUMN concession_rule.description IS 'Additional details about the concession';
COMMENT ON COLUMN concession_rule.is_active IS 'Whether this concession is currently active';

CREATE INDEX idx_concession_rule_active ON concession_rule(is_active);

-- =====================================================================
-- VERIFICATION
-- =====================================================================
DO $$
DECLARE
    table_count INTEGER;
    rec RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== Fares Module Created ===';
    RAISE NOTICE '';
    
    -- Count tables created
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('quota', 'concession_rule');
    
    RAISE NOTICE 'Tables created: %', table_count;
    RAISE NOTICE '';
    
    -- List tables
    FOR rec IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('quota', 'concession_rule')
        ORDER BY table_name
    LOOP
        RAISE NOTICE '  - %', rec.table_name;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE 'Module: Fares';
    RAISE NOTICE 'Status: ✓ Complete';
    RAISE NOTICE '';
END $$;
