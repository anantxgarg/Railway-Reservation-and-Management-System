-- =====================================================================
-- C3 Booking — 02: quota and concession_rule
--
-- quota           — Team 3. Waitlist/RAC queues are scoped by quota.
-- concession_rule — Team 4 (payments, refunds, concessions). The one list
--                   of concessions and their discounts: calc_fare applies
--                   them at booking, the payments app reads them for its
--                   preview and the staff verification of applications.
-- =====================================================================

-- ---------------------------------------------------------------------
-- quota
-- ---------------------------------------------------------------------
CREATE TABLE quota (
    quota_code VARCHAR(10) PRIMARY KEY,
    quota_name quota_name_enum NOT NULL UNIQUE,
    fare_multiplier NUMERIC(5,2) NOT NULL DEFAULT 1.00,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_quota_fare_multiplier CHECK (fare_multiplier > 0)
);

COMMENT ON TABLE quota IS 'Booking allocation categories (General, Tatkal, Ladies, Senior)';
COMMENT ON COLUMN quota.quota_code IS 'Unique quota code (e.g., GN, TK, LD, SR)';
COMMENT ON COLUMN quota.fare_multiplier IS 'Fare multiplier (e.g., 1.0 for General, 1.3 for Tatkal)';

-- ---------------------------------------------------------------------
-- concession_rule (Team 4)
-- ---------------------------------------------------------------------
CREATE TABLE concession_rule (
    concession_id SERIAL PRIMARY KEY,
    category VARCHAR(30) NOT NULL UNIQUE,
    concession_name VARCHAR(100) NOT NULL UNIQUE,
    eligibility_rule TEXT NOT NULL,
    discount_type VARCHAR(50) NOT NULL,
    discount_value NUMERIC(10,2) NOT NULL,
    min_age INTEGER,
    max_age INTEGER,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_concession_category CHECK (category ~ '^[A-Z][A-Z_]*$'),
    CONSTRAINT chk_concession_discount_value CHECK (discount_value >= 0),
    CONSTRAINT chk_concession_discount_type CHECK (discount_type IN ('PERCENTAGE', 'FIXED_AMOUNT')),
    CONSTRAINT chk_concession_ages CHECK (min_age IS NULL OR max_age IS NULL OR min_age <= max_age)
);

COMMENT ON TABLE concession_rule IS 'Passenger concessions and their discounts (Team 4); applied by calc_fare at booking';
COMMENT ON COLUMN concession_rule.category IS 'Code used by the payments API, e.g. STUDENT, SENIOR_CITIZEN';
COMMENT ON COLUMN concession_rule.eligibility_rule IS 'Eligibility criteria shown to users; staff verify the documents';
COMMENT ON COLUMN concession_rule.discount_type IS 'PERCENTAGE or FIXED_AMOUNT';
COMMENT ON COLUMN concession_rule.discount_value IS 'Percentage 0-100 or fixed amount';
COMMENT ON COLUMN concession_rule.min_age IS 'Youngest passenger allowed (create_booking checks it); NULL means no limit';
COMMENT ON COLUMN concession_rule.max_age IS 'Oldest passenger allowed (create_booking checks it); NULL means no limit';
