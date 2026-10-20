-- =====================================================================
-- C3 Booking — 02: quota and concession_rule
--
-- quota           — Team 3. Waitlist/RAC queues are scoped by quota.
-- concession_rule — PLACEHOLDER, owned by Team 4 (payments, refunds,
--                   concession rules). passenger.concession_id needs the
--                   table to exist; Team 4 should take this definition over.
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
-- concession_rule (placeholder — Team 4)
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

    CONSTRAINT chk_concession_discount_value CHECK (discount_value >= 0),
    CONSTRAINT chk_concession_discount_type CHECK (discount_type IN ('PERCENTAGE', 'FIXED_AMOUNT'))
);

COMMENT ON TABLE concession_rule IS 'Passenger-specific fare discounts (placeholder; owned by Team 4)';
COMMENT ON COLUMN concession_rule.eligibility_rule IS 'Eligibility criteria (free text)';
COMMENT ON COLUMN concession_rule.discount_type IS 'PERCENTAGE or FIXED_AMOUNT';
COMMENT ON COLUMN concession_rule.discount_value IS 'Percentage 0-100 or fixed amount';
