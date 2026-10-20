-- =====================================================================
-- C3 Booking — development seed data
--
-- Reference data (classes, quotas, concessions) plus a small network:
-- 3 trains, 3 routes, daily runs for the next 30 days, coaches and seats.
-- Users come from C1's seed_dev_users.sql (e.g. customer@example.com).
-- The network part is placeholder data until Team 2 provides its own.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Travel classes
-- ---------------------------------------------------------------------
INSERT INTO travel_class (class_code, class_name, is_ac, seats_per_coach, base_fare_per_km, reservation_charge) VALUES
('1A', 'First AC',       TRUE,  18, 5.50, 60.00),
('2A', 'Second AC',      TRUE,  48, 3.50, 50.00),
('3A', 'Third AC',       TRUE,  64, 2.50, 40.00),
('SL', 'Sleeper',        FALSE, 72, 1.20, 20.00),
('2S', 'Second Sitting', FALSE, 108, 0.80, 15.00);

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

-- ---------------------------------------------------------------------
-- Stations
-- ---------------------------------------------------------------------
INSERT INTO station (station_code, station_name, city, state, zone, num_platforms) VALUES
('NDLS', 'New Delhi',                    'New Delhi', 'Delhi',          'Northern',       16),
('KOTA', 'Kota Junction',                'Kota',      'Rajasthan',      'West Central',    5),
('BRC',  'Vadodara Junction',            'Vadodara',  'Gujarat',        'Western',         7),
('BCT',  'Mumbai Central',               'Mumbai',    'Maharashtra',    'Western',         9),
('BPL',  'Bhopal Junction',              'Bhopal',    'Madhya Pradesh', 'West Central',    6),
('NGP',  'Nagpur Junction',              'Nagpur',    'Maharashtra',    'Central',         8),
('MAS',  'Chennai Central',              'Chennai',   'Tamil Nadu',     'Southern',       17),
('CSMT', 'Chhatrapati Shivaji Terminus', 'Mumbai',    'Maharashtra',    'Central',        18),
('PUNE', 'Pune Junction',                'Pune',      'Maharashtra',    'Central',         6);

-- ---------------------------------------------------------------------
-- Trains
-- ---------------------------------------------------------------------
INSERT INTO train (train_no, train_name, train_type) VALUES
('12952', 'Mumbai Rajdhani Express', 'Express'),
('12622', 'Tamil Nadu Express',      'Express'),
('12127', 'Mumbai Pune Intercity',   'Express');

-- ---------------------------------------------------------------------
-- Routes and stops
-- ---------------------------------------------------------------------
INSERT INTO route (route_code, route_name) VALUES
('NDLS-BCT', 'New Delhi - Mumbai Central via Kota, Vadodara'),
('NDLS-MAS', 'New Delhi - Chennai Central via Bhopal, Nagpur'),
('CSMT-PUNE', 'Mumbai CSMT - Pune');

INSERT INTO route_station (route_id, stop_seq, station_code, distance_km, arrival_offset, departure_offset, day_offset)
SELECT r.route_id, s.stop_seq, s.station_code, s.distance_km, s.arrival_offset, s.departure_offset, s.day_offset
FROM (VALUES
    ('NDLS-BCT',  1, 'NDLS',    0, NULL,    0, 0),
    ('NDLS-BCT',  2, 'KOTA',  465,  270,  275, 0),
    ('NDLS-BCT',  3, 'BRC',   993,  610,  618, 1),
    ('NDLS-BCT',  4, 'BCT',  1384,  930,  930, 1),
    ('NDLS-MAS',  1, 'NDLS',    0, NULL,    0, 0),
    ('NDLS-MAS',  2, 'BPL',   705,  470,  480, 0),
    ('NDLS-MAS',  3, 'NGP',  1095,  860,  870, 1),
    ('NDLS-MAS',  4, 'MAS',  2182, 1800, 1800, 1),
    ('CSMT-PUNE', 1, 'CSMT',    0, NULL,    0, 0),
    ('CSMT-PUNE', 2, 'PUNE',  192,  190,  190, 0)
) AS s(route_code, stop_seq, station_code, distance_km, arrival_offset, departure_offset, day_offset)
JOIN route r USING (route_code);

-- ---------------------------------------------------------------------
-- Schedules: every train runs daily on its route
-- ---------------------------------------------------------------------
INSERT INTO train_schedule (train_no, run_day, route_id)
SELECT t.train_no, d.run_day, r.route_id
FROM (VALUES ('12952', 'NDLS-BCT'), ('12622', 'NDLS-MAS'), ('12127', 'CSMT-PUNE')) AS t(train_no, route_code)
JOIN route r USING (route_code)
CROSS JOIN (VALUES ('Monday'), ('Tuesday'), ('Wednesday'), ('Thursday'),
                   ('Friday'), ('Saturday'), ('Sunday')) AS d(run_day);

-- ---------------------------------------------------------------------
-- Runs: next 30 days for each train
-- ---------------------------------------------------------------------
INSERT INTO train_run (train_no, run_date, status)
SELECT t.train_no, CURRENT_DATE + g.day, 'SCHEDULED'
FROM train t
CROSS JOIN generate_series(0, 29) AS g(day);

-- ---------------------------------------------------------------------
-- Coaches
-- ---------------------------------------------------------------------
INSERT INTO train_coach (train_no, coach_no, class_code)
SELECT c.train_no, c.prefix || g.n, c.class_code
FROM (VALUES
    ('12952', 'H', '1A', 1),
    ('12952', 'A', '2A', 2),
    ('12952', 'B', '3A', 3),
    ('12622', 'A', '2A', 1),
    ('12622', 'B', '3A', 2),
    ('12622', 'S', 'SL', 4),
    ('12127', 'D', '2S', 4)
) AS c(train_no, prefix, class_code, coaches)
CROSS JOIN LATERAL generate_series(1, c.coaches) AS g(n);

-- ---------------------------------------------------------------------
-- Seats: seats_per_coach berths per coach, with berth types by layout
--   1A: LB/UB pairs · 2A: bays of 6 (LB UB LB UB SL SU)
--   3A/SL: bays of 8 (LB MB UB LB MB UB SL SU) · 2S: rows of 3 (WS MS AS)
-- ---------------------------------------------------------------------
INSERT INTO seat (train_no, coach_no, berth_no, berth_type)
SELECT tc.train_no, tc.coach_no, b.n::TEXT,
       CASE tc.class_code
           WHEN '1A' THEN (ARRAY['LB','UB'])[(b.n - 1) % 2 + 1]
           WHEN '2A' THEN (ARRAY['LB','UB','LB','UB','SL','SU'])[(b.n - 1) % 6 + 1]
           WHEN '2S' THEN (ARRAY['WS','MS','AS'])[(b.n - 1) % 3 + 1]
           ELSE           (ARRAY['LB','MB','UB','LB','MB','UB','SL','SU'])[(b.n - 1) % 8 + 1]
       END
FROM train_coach tc
JOIN travel_class tcl USING (class_code)
CROSS JOIN LATERAL generate_series(1, tcl.seats_per_coach) AS b(n);
