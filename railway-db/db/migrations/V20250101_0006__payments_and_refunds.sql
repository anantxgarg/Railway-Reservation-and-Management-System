-- =====================================================
-- Migration: V20250101_0006__payments_and_refunds.sql
-- Description: Payments & Refunds Module
-- Tables: payment, payment_transaction, refund
-- Dependencies: Booking module
-- =====================================================

-- =====================================================
-- Table: payment
-- Description: Payment records for bookings
-- =====================================================
CREATE TABLE payment (
    payment_id SERIAL PRIMARY KEY,
    pnr VARCHAR(10) NOT NULL UNIQUE,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    provider payment_provider_enum NOT NULL,
    order_id VARCHAR(100) NOT NULL UNIQUE,
    status payment_status_enum NOT NULL DEFAULT 'CREATED',
    method payment_method_enum,
    paid_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT fk_payment_booking FOREIGN KEY (pnr) 
        REFERENCES booking(pnr) ON DELETE RESTRICT,
    
    -- Business Rules
    CONSTRAINT chk_payment_amount CHECK (amount > 0),
    CONSTRAINT chk_payment_currency CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT chk_payment_paid_at CHECK (
        (status = 'SUCCESS' AND paid_at IS NOT NULL) OR
        (status != 'SUCCESS' AND paid_at IS NULL)
    ),
    CONSTRAINT chk_payment_method CHECK (
        (status IN ('SUCCESS', 'REFUNDED', 'PARTIAL_REFUND') AND method IS NOT NULL) OR
        (status NOT IN ('SUCCESS', 'REFUNDED', 'PARTIAL_REFUND'))
    )
);

-- Indexes for payment
CREATE INDEX idx_payment_pnr ON payment(pnr);
CREATE INDEX idx_payment_order_id ON payment(order_id);
CREATE INDEX idx_payment_status ON payment(status);
CREATE INDEX idx_payment_created_at ON payment(created_at);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_payment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_payment_timestamp
    BEFORE UPDATE ON payment
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_timestamp();

COMMENT ON TABLE payment IS 'Payment records for bookings (one payment per booking)';
COMMENT ON COLUMN payment.order_id IS 'Payment gateway order identifier (unique across system)';
COMMENT ON COLUMN payment.paid_at IS 'Timestamp when payment was successfully completed';

-- =====================================================
-- Table: payment_transaction
-- Description: Individual transaction attempts for a payment
-- =====================================================
CREATE TABLE payment_transaction (
    transaction_id SERIAL PRIMARY KEY,
    payment_id INTEGER NOT NULL,
    provider_payment_id VARCHAR(100),
    transaction_type transaction_type_enum NOT NULL DEFAULT 'PAYMENT',
    amount DECIMAL(10, 2) NOT NULL,
    status transaction_status_enum NOT NULL DEFAULT 'INITIATED',
    error_code VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT fk_transaction_payment FOREIGN KEY (payment_id) 
        REFERENCES payment(payment_id) ON DELETE CASCADE,
    
    -- Business Rules
    CONSTRAINT chk_transaction_amount CHECK (amount > 0),
    CONSTRAINT chk_transaction_error CHECK (
        (status = 'FAILED' AND error_code IS NOT NULL) OR
        (status != 'FAILED')
    )
);

-- Indexes for payment_transaction
CREATE INDEX idx_transaction_payment ON payment_transaction(payment_id);
CREATE INDEX idx_transaction_provider_payment_id ON payment_transaction(provider_payment_id);
CREATE INDEX idx_transaction_status ON payment_transaction(status);
CREATE INDEX idx_transaction_created_at ON payment_transaction(created_at);

COMMENT ON TABLE payment_transaction IS 'Individual transaction attempts for a payment (multiple attempts possible)';
COMMENT ON COLUMN payment_transaction.provider_payment_id IS 'Payment gateway transaction identifier';
COMMENT ON COLUMN payment_transaction.transaction_type IS 'Type of transaction (currently only PAYMENT)';

-- =====================================================
-- Table: refund
-- Description: Refund records for cancelled passengers
-- =====================================================
CREATE TABLE refund (
    refund_id SERIAL PRIMARY KEY,
    passenger_id INTEGER NOT NULL UNIQUE,
    transaction_id INTEGER NOT NULL,
    provider_refund_id VARCHAR(100) UNIQUE,
    refund_amount DECIMAL(10, 2) NOT NULL,
    reason TEXT,
    status refund_status_enum NOT NULL DEFAULT 'INITIATED',
    initiated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Constraints
    CONSTRAINT fk_refund_passenger FOREIGN KEY (passenger_id) 
        REFERENCES passenger(passenger_id) ON DELETE RESTRICT,
    CONSTRAINT fk_refund_transaction FOREIGN KEY (transaction_id) 
        REFERENCES payment_transaction(transaction_id) ON DELETE RESTRICT,
    
    -- Business Rules
    CONSTRAINT chk_refund_amount CHECK (refund_amount >= 0),
    CONSTRAINT chk_refund_completed_at CHECK (
        (status = 'SUCCESS' AND completed_at IS NOT NULL) OR
        (status != 'SUCCESS' AND completed_at IS NULL)
    )
);

-- Indexes for refund
CREATE INDEX idx_refund_passenger ON refund(passenger_id);
CREATE INDEX idx_refund_transaction ON refund(transaction_id);
CREATE INDEX idx_refund_provider_refund_id ON refund(provider_refund_id);
CREATE INDEX idx_refund_status ON refund(status);
CREATE INDEX idx_refund_initiated_at ON refund(initiated_at);

COMMENT ON TABLE refund IS 'Refund records for cancelled passengers (one refund per passenger)';
COMMENT ON COLUMN refund.provider_refund_id IS 'Payment gateway refund identifier';
COMMENT ON COLUMN refund.refund_amount IS 'Amount to be refunded (after deducting cancellation charges)';

-- =====================================================
-- Migration complete
-- =====================================================
