-- =========================================================================
-- C2 Network — development seed data (seed_dev.sql)
--
-- Travel classes, stations and a sample network: Team 3's three trains
-- (New Delhi - Mumbai / Chennai, Mumbai - Pune) and Team 2's three
-- (Pune - Mumbai / Solapur / Hubballi), with runs on every scheduled day of
-- the next 30 days, coaches and seats. Booking reference data (quotas,
-- concessions) is in C3's seed_dev.sql.
-- =========================================================================

-- ---------------------------------------------------------------------
-- Travel classes
-- ---------------------------------------------------------------------
INSERT INTO travel_class (class_code, class_name, is_ac, seats_per_coach, base_fare_per_km, reservation_charge) VALUES
('1A', 'First AC',       TRUE,  18, 5.50, 60.00),
('2A', 'Second AC',      TRUE,  48, 3.50, 50.00),
('3A', 'Third AC',       TRUE,  64, 2.50, 40.00),
('SL', 'Sleeper',        FALSE, 72, 1.20, 20.00),
('2S', 'Second Sitting', FALSE, 108, 0.80, 15.00),
('CC', 'AC Chair Car',   TRUE,  78, 1.20, 25.00);

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
('PUNE', 'Pune Junction',                'Pune',      'Maharashtra',    'Central',         6),
('SUR',  'Solapur Junction',             'Solapur',   'Maharashtra',    'Central',         5),
('BJP',  'Vijayapura',                   'Vijayapura', 'Karnataka',     'South Western',   3),
('UBL',  'Hubballi Junction',            'Hubballi',  'Karnataka',      'South Western',   8);

-- ---------------------------------------------------------------------
-- Trains
-- ---------------------------------------------------------------------
INSERT INTO train (train_no, train_name, train_type) VALUES
('12952', 'Mumbai Rajdhani Express', 'Express'),
('12622', 'Tamil Nadu Express',      'Express'),
('12127', 'Mumbai Pune Intercity',   'Express'),
('12128', 'Mumbai CSMT Intercity Express', 'Express'),
('11139', 'Chhatrapati Shahu Maharaj Terminus - Gadag Express', 'Express'),
('16535', 'Gol Gumbaz Express',      'Express');

-- ---------------------------------------------------------------------
-- Routes and stops
-- ---------------------------------------------------------------------
-- departure_time is when the train leaves the first stop; the offsets are
-- minutes from it, and day_offset is worked out from them (triggers.sql).
INSERT INTO route (route_code, route_name, departure_time) VALUES
('NDLS-BCT',  'New Delhi - Mumbai Central via Kota, Vadodara',  '16:55'),
('NDLS-MAS',  'New Delhi - Chennai Central via Bhopal, Nagpur', '10:00'),
('CSMT-PUNE', 'Mumbai CSMT - Pune',                             '06:40'),
('PUNE-CSMT', 'Pune - Mumbai CSMT',                             '05:55'),
('PUNE-SUR',  'Pune - Solapur',                                 '01:05'),
('PUNE-UBL',  'Pune - Hubballi via Solapur, Vijayapura',        '10:00');

INSERT INTO route_station (route_id, stop_seq, station_code, distance_km, arrival_offset, departure_offset)
SELECT r.route_id, s.stop_seq, s.station_code, s.distance_km, s.arrival_offset, s.departure_offset
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
    ('CSMT-PUNE', 2, 'PUNE',  192,  190,  190, 0),
    -- Team 2's sample trains (times from their timetable: 05:55-09:05,
    -- 01:05-05:20, and 10:00 / 14:30-14:35 / 16:45-16:50 / 22:15)
    ('PUNE-CSMT', 1, 'PUNE',    0, NULL,    0, 0),
    ('PUNE-CSMT', 2, 'CSMT',  192,  190,  190, 0),
    ('PUNE-SUR',  1, 'PUNE',    0, NULL,    0, 0),
    ('PUNE-SUR',  2, 'SUR',   262,  255,  255, 0),
    ('PUNE-UBL',  1, 'PUNE',    0, NULL,    0, 0),
    ('PUNE-UBL',  2, 'SUR',   262,  270,  275, 0),
    ('PUNE-UBL',  3, 'BJP',   372,  405,  410, 0),
    ('PUNE-UBL',  4, 'UBL',   631,  735,  735, 0)
) AS s(route_code, stop_seq, station_code, distance_km, arrival_offset, departure_offset, day_offset)
JOIN route r USING (route_code);

-- ---------------------------------------------------------------------
-- Schedules: the first four trains run daily; 11139 on Mon/Wed/Fri and
-- 16535 on Tue/Thu/Sun (Team 2's sample timetable)
-- ---------------------------------------------------------------------
INSERT INTO train_schedule (train_no, run_day, route_id)
SELECT t.train_no, d.run_day, r.route_id
FROM (VALUES ('12952', 'NDLS-BCT'), ('12622', 'NDLS-MAS'), ('12127', 'CSMT-PUNE'),
             ('12128', 'PUNE-CSMT')) AS t(train_no, route_code)
JOIN route r USING (route_code)
CROSS JOIN (VALUES ('Monday'), ('Tuesday'), ('Wednesday'), ('Thursday'),
                   ('Friday'), ('Saturday'), ('Sunday')) AS d(run_day);

INSERT INTO train_schedule (train_no, run_day, route_id)
SELECT t.train_no, t.run_day, r.route_id
FROM (VALUES ('11139', 'PUNE-SUR', 'Monday'), ('11139', 'PUNE-SUR', 'Wednesday'), ('11139', 'PUNE-SUR', 'Friday'),
             ('16535', 'PUNE-UBL', 'Tuesday'), ('16535', 'PUNE-UBL', 'Thursday'), ('16535', 'PUNE-UBL', 'Sunday')
) AS t(train_no, route_code, run_day)
JOIN route r USING (route_code);

-- ---------------------------------------------------------------------
-- Runs: every scheduled day in the next 30 days
-- ---------------------------------------------------------------------
INSERT INTO train_run (train_no, run_date, status)
SELECT s.train_no, CURRENT_DATE + g.day, 'SCHEDULED'
FROM generate_series(0, 29) AS g(day)
JOIN train_schedule s ON s.run_day = to_char(CURRENT_DATE + g.day, 'FMDay');

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
    ('12127', 'D', '2S', 4),
    -- Team 2's coaches; 11139 had none, so it gets sleeper and 3A coaches
    ('12128', 'C', 'CC', 2),
    ('12128', 'D', 'SL', 1),
    ('16535', 'A', '2A', 1),
    ('16535', 'B', '3A', 1),
    ('16535', 'S', 'SL', 2),
    ('11139', 'B', '3A', 1),
    ('11139', 'S', 'SL', 2)
) AS c(train_no, prefix, class_code, coaches)
CROSS JOIN LATERAL generate_series(1, c.coaches) AS g(n);

-- ---------------------------------------------------------------------
-- Seats: seats_per_coach berths per coach, with berth types by layout
--   1A: LB/UB pairs · 2A: bays of 6 (LB UB LB UB SL SU)
--   3A/SL: bays of 8 (LB MB UB LB MB UB SL SU) · 2S/CC: rows of 3 (WS MS AS)
-- ---------------------------------------------------------------------
INSERT INTO seat (train_no, coach_no, berth_no, berth_type)
SELECT tc.train_no, tc.coach_no, b.n::TEXT,
       CASE tc.class_code
           WHEN '1A' THEN (ARRAY['LB','UB'])[(b.n - 1) % 2 + 1]
           WHEN '2A' THEN (ARRAY['LB','UB','LB','UB','SL','SU'])[(b.n - 1) % 6 + 1]
           WHEN '2S' THEN (ARRAY['WS','MS','AS'])[(b.n - 1) % 3 + 1]
           WHEN 'CC' THEN (ARRAY['WS','MS','AS'])[(b.n - 1) % 3 + 1]
           ELSE           (ARRAY['LB','MB','UB','LB','MB','UB','SL','SU'])[(b.n - 1) % 8 + 1]
       END
FROM train_coach tc
JOIN travel_class tcl USING (class_code)
CROSS JOIN LATERAL generate_series(1, tcl.seats_per_coach) AS b(n);
