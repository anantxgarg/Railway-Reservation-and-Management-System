-- =====================================================================
-- C3 Booking — development seed data
--
-- Booking reference data: quotas and concession rules. The trains,
-- classes, runs and seats come from C2's seed_dev.sql, users from C1's
-- seed_dev_users.sql (e.g. customer@example.com).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Quotas
-- ---------------------------------------------------------------------
INSERT INTO quota (quota_code, quota_name, fare_multiplier, description) VALUES
('GN', 'General', 1.00, 'Regular booking quota'),
('TK', 'Tatkal',  1.30, 'Last-minute booking quota with higher fare'),
('LD', 'Ladies',  1.00, 'Reserved for women travellers'),
('SR', 'Senior',  1.00, 'Reserved for senior citizens');

-- ---------------------------------------------------------------------
-- Concession rules (placeholder data; Team 4 owns concessions)
-- ---------------------------------------------------------------------
INSERT INTO concession_rule (concession_name, eligibility_rule, discount_type, discount_value, description) VALUES
('Senior Citizen', 'Age >= 60',                  'PERCENTAGE', 40.00, 'Discount for passengers aged 60 and above'),
('Child',          'Age 5 to 11',                'PERCENTAGE', 50.00, 'Discount for children aged 5-11'),
('Disabled',       'Has disability certificate', 'PERCENTAGE', 75.00, 'Discount for passengers with disabilities');
