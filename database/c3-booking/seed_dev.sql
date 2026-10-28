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
-- Concession rules (Team 4). The payments app and the booking form read
-- them from here; change the numbers here only.
-- ---------------------------------------------------------------------
INSERT INTO concession_rule (category, concession_name, eligibility_rule, discount_type, discount_value,
                             min_age, max_age, description) VALUES
('SENIOR_CITIZEN',    'Senior Citizen',    'Age 60 or more',                         'PERCENTAGE', 40.00, 60,   NULL, 'Proof of age, e.g. Aadhaar'),
('STUDENT',           'Student',           'Full-time student',                      'PERCENTAGE', 25.00, NULL, NULL, 'Student identity card'),
('CHILD',             'Child',             'Age 5 to 11',                            'PERCENTAGE', 50.00, 5,    11,   'Proof of age, e.g. birth certificate'),
('DIFFERENTLY_ABLED', 'Differently Abled', 'Holds a disability certificate',         'PERCENTAGE', 50.00, NULL, NULL, 'Disability certificate'),
('ARMED_FORCES',      'Armed Forces',      'Serving member of the armed forces',     'PERCENTAGE', 30.00, NULL, NULL, 'Service identity card');
