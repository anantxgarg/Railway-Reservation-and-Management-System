-- =========================================================================
-- Development Seed Data for C2-Network Microservice (seed_dev.sql)
-- =========================================================================

-- 1. Travel Classes (Master Data)
INSERT INTO "travel_class" ("class_code", "class_name", "is_ac", "seats_per_coach", "base_fare_per_km", "reservation_charge") VALUES
('1A', 'AC First Class', true, 24, 3.50, 60.00),
('2A', 'AC 2-Tier', true, 48, 2.20, 50.00),
('3A', 'AC 3-Tier', true, 64, 1.50, 40.00),
('SL', 'Sleeper Class', false, 72, 0.60, 20.00),
('CC', 'AC Chair Car', true, 78, 1.20, 25.00)
ON CONFLICT ("class_code") DO NOTHING;

-- 2. Sample Stations
INSERT INTO "station" ("station_code", "station_name") VALUES
('PUNE', 'Pune Junction'),
('CSMT', 'Mumbai CSMT'),
('SUR', 'Solapur Junction'),
('UBL', 'SSSSS Hubballi Junction'),
('BJP', 'Vijayapura')
ON CONFLICT ("station_code") DO NOTHING;

-- 3. Sample Trains
INSERT INTO "train" ("train_no", "train_name", "is_active") VALUES
(12128, 'Mumbai CSMT Intercity Express', true),
(11139, 'Chhatrapati Shahu Maharaj Terminus - Gadag Express', true),
(16535, 'Gol Gumbaz Express', true)
ON CONFLICT ("train_no") DO NOTHING;

-- 4. Sample Route Station Sequences
INSERT INTO "route_station" ("train_no", "stop_seq", "station_code", "distance_km", "arrival_time", "departure_time") VALUES
-- Train 12128 (PUNE to CSMT)
(12128, 1, 'PUNE', 0.00, NULL, '05:55:00'),
(12128, 2, 'CSMT', 192.00, '09:05:00', NULL),

-- Train 11139 (PUNE to SUR)
(11139, 1, 'PUNE', 0.00, NULL, '01:05:00'),
(11139, 2, 'SUR', 262.00, '05:20:00', NULL),

-- Train 16535 (PUNE -> SUR -> BJP -> UBL)
(16535, 1, 'PUNE', 0.00, NULL, '10:00:00'),
(16535, 2, 'SUR', 262.00, '14:30:00', '14:35:00'),
(16535, 3, 'BJP', 372.00, '16:45:00', '16:50:00'),
(16535, 4, 'UBL', 631.00, '22:15:00', NULL)
ON CONFLICT ("train_no", "stop_seq") DO NOTHING;

-- 5. Sample Train Coaches
INSERT INTO "train_coach" ("train_no", "coach_no", "class_code") VALUES
(12128, 'C1', 'CC'),
(12128, 'C2', 'CC'),
(12128, 'D1', 'SL'),
(16535, 'A1', '2A'),
(16535, 'B1', '3A'),
(16535, 'S1', 'SL'),
(16535, 'S2', 'SL')
ON CONFLICT ("train_no", "coach_no") DO NOTHING;

-- 6. Sample Train Schedule (Operating days)
INSERT INTO "train_schedule" ("train_no", "run_day") VALUES
(12128, 'MON'), (12128, 'TUE'), (12128, 'WED'), (12128, 'THU'), (12128, 'FRI'), (12128, 'SAT'), (12128, 'SUN'),
(11139, 'MON'), (11139, 'WED'), (11139, 'FRI'),
(16535, 'TUE'), (16535, 'THU'), (16535, 'SUN')
ON CONFLICT ("train_no", "run_day") DO NOTHING;

-- 7. Sample Train Runs (Upcoming operational dates)
INSERT INTO "train_run" ("train_no", "run_date", "status") VALUES
(12128, CURRENT_DATE, 'SCHEDULED'),
(12128, CURRENT_DATE + 1, 'SCHEDULED'),
(16535, CURRENT_DATE, 'SCHEDULED'),
(16535, CURRENT_DATE + 2, 'SCHEDULED')
ON CONFLICT ("train_no", "run_date") DO NOTHING;