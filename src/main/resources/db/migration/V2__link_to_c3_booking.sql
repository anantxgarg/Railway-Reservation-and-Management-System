-- =====================================================================
-- Module 4 V2: payments, refunds and concession applications now belong
-- to the real bookings of C3 (Team 3), identified by PNR, instead of the
-- stand-in "bookings" table this app used to create.
--
-- Needs the C3 tables, so build the shared database with
-- database/setup.sh before starting this app.
--
-- Rows written against the stand-in bookings point at bookings that no
-- longer exist, so they are removed (development data only).
-- =====================================================================

DROP TABLE IF EXISTS bookings;   -- the stand-in, created by Hibernate (ddl-auto=update) before

DELETE FROM refunds;
DELETE FROM payments;
DELETE FROM concession_applications;

-- 1. payments -----------------------------------------------------------
ALTER TABLE payments DROP COLUMN booking_id;
ALTER TABLE payments ADD COLUMN pnr VARCHAR(10) NOT NULL;
ALTER TABLE payments
    ADD CONSTRAINT fk_payments_booking FOREIGN KEY (pnr) REFERENCES booking (pnr),
    ADD CONSTRAINT fk_payments_user    FOREIGN KEY (user_id) REFERENCES users (user_id),
    ADD CONSTRAINT chk_payments_amount CHECK (amount > 0),
    ADD CONSTRAINT chk_payments_status CHECK (status IN ('CREATED', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'));
CREATE INDEX ix_payments_pnr ON payments (pnr);

-- 2. refunds ------------------------------------------------------------
ALTER TABLE refunds DROP COLUMN booking_id;
ALTER TABLE refunds ADD COLUMN pnr VARCHAR(10) NOT NULL;
ALTER TABLE refunds
    ADD CONSTRAINT fk_refunds_booking FOREIGN KEY (pnr) REFERENCES booking (pnr),
    ADD CONSTRAINT fk_refunds_payment FOREIGN KEY (payment_id) REFERENCES payments (id),
    ADD CONSTRAINT fk_refunds_user    FOREIGN KEY (user_id) REFERENCES users (user_id),
    ADD CONSTRAINT chk_refunds_amount CHECK (amount >= 0),
    ADD CONSTRAINT chk_refunds_status CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED'));
CREATE INDEX ix_refunds_pnr ON refunds (pnr);

-- 3. concession applications: per passenger of a booking ----------------
ALTER TABLE concession_applications DROP COLUMN booking_id;
ALTER TABLE concession_applications ADD COLUMN pnr VARCHAR(10) NOT NULL;
ALTER TABLE concession_applications ADD COLUMN passenger_id INTEGER NOT NULL;
ALTER TABLE concession_applications
    ADD CONSTRAINT fk_concessions_booking   FOREIGN KEY (pnr) REFERENCES booking (pnr),
    ADD CONSTRAINT fk_concessions_passenger FOREIGN KEY (passenger_id) REFERENCES passenger (passenger_id),
    ADD CONSTRAINT fk_concessions_user      FOREIGN KEY (user_id) REFERENCES users (user_id);
CREATE INDEX ix_concessions_pnr ON concession_applications (pnr);
