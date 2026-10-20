-- =====================================================================
-- Module 4: Payments, Refunds & Concessions Database Schema (PostgreSQL)
-- Matches team architecture, types, and conventions
-- =====================================================================

-- 1. Payments table
CREATE TABLE IF NOT EXISTS payments (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id          BIGINT NOT NULL,
    user_id             INTEGER,
    razorpay_order_id   VARCHAR(100) UNIQUE NOT NULL,
    razorpay_payment_id VARCHAR(100),
    amount              NUMERIC(12, 2) NOT NULL,
    currency            VARCHAR(10) NOT NULL DEFAULT 'INR',
    status              VARCHAR(30) NOT NULL,
    version             BIGINT NOT NULL DEFAULT 0,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payments_booking_id ON payments (booking_id);
CREATE INDEX IF NOT EXISTS ix_payments_razorpay_order_id ON payments (razorpay_order_id);
CREATE INDEX IF NOT EXISTS ix_payments_user_id ON payments (user_id);

-- 2. Refunds table
CREATE TABLE IF NOT EXISTS refunds (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id            BIGINT NOT NULL,
    payment_id            BIGINT NOT NULL,
    user_id               INTEGER,
    razorpay_refund_id    VARCHAR(100) UNIQUE,
    amount                NUMERIC(12, 2) NOT NULL,
    refund_percent        NUMERIC(5, 2) NOT NULL,
    reason                VARCHAR(255),
    status                VARCHAR(30) NOT NULL,
    processed_by_staff_id INTEGER,
    created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_refunds_booking_id ON refunds (booking_id);
CREATE INDEX IF NOT EXISTS ix_refunds_payment_id ON refunds (payment_id);
CREATE INDEX IF NOT EXISTS ix_refunds_razorpay_refund_id ON refunds (razorpay_refund_id);

-- 3. Concession applications & audit
CREATE TABLE IF NOT EXISTS concession_applications (
    id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id             BIGINT NOT NULL,
    user_id                INTEGER,
    passenger_name         VARCHAR(100) NOT NULL,
    category               VARCHAR(50) NOT NULL,
    id_card_type           VARCHAR(50) NOT NULL,
    id_card_number         VARCHAR(100) NOT NULL,
    document_reference_url VARCHAR(255),
    discount_percent       NUMERIC(5, 2) NOT NULL,
    discount_amount        NUMERIC(12, 2) NOT NULL,
    status                 VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    verified_by_staff_id   INTEGER,
    remarks                VARCHAR(255),
    created_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_concessions_booking_id ON concession_applications (booking_id);
CREATE INDEX IF NOT EXISTS ix_concessions_user_id ON concession_applications (user_id);
CREATE INDEX IF NOT EXISTS ix_concessions_status ON concession_applications (status);

-- 4. Processed Webhook Events (Idempotency safety net)
CREATE TABLE IF NOT EXISTS processed_webhook_events (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id        VARCHAR(100) UNIQUE NOT NULL,
    event_type      VARCHAR(100) NOT NULL,
    payload_summary TEXT,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_webhook_event_id ON processed_webhook_events (event_id);
