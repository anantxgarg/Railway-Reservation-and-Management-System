-- =====================================================
-- Migration: V20250101_0007__seed_data.sql
-- Description: Minimal seed data for testing and development
-- Dependencies: All previous migrations
-- =====================================================

-- =====================================================
-- Roles (3 roles)
-- =====================================================
INSERT INTO roles (role_name, description) VALUES
('CUSTOMER', 'Regular customer who can book tickets'),
('STAFF', 'Railway staff with operational privileges'),
('ADMIN', 'System administrator with full access');

-- =====================================================
-- Permissions (15 permissions)
-- =====================================================
INSERT INTO permissions (permission_name, description) VALUES
-- Customer permissions
('BOOK_TICKET', 'Book train tickets'),
('CANCEL_OWN_BOOKING', 'Cancel own bookings'),
('VIEW_OWN_BOOKINGS', 'View own booking history'),
('MAKE_PAYMENT', 'Make payment for bookings'),

-- Staff permissions
('VIEW_ALL_BOOKINGS', 'View all bookings in the system'),
('CANCEL_ANY_BOOKING', 'Cancel any booking'),
('VIEW_SEAT_CHART', 'View seat chart for trains'),
('MANAGE_TRAIN_SCHEDULES', 'Create and modify train schedules'),
('VIEW_REPORTS', 'View system reports and analytics'),

-- Admin permissions
('MANAGE_USERS', 'Create, update, and delete users'),
('MANAGE_ROLES', 'Create and modify roles and permissions'),
('MANAGE_TRAINS', 'Create and modify train information'),
('MANAGE_STATIONS', 'Create and modify station information'),
('MANAGE_FARES', 'Modify fare rules and concessions'),
('SYSTEM_CONFIG', 'Configure system settings');

-- =====================================================
-- Role-Permission Mappings
-- =====================================================
-- Customer permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'CUSTOMER'
AND p.permission_name IN ('BOOK_TICKET', 'CANCEL_OWN_BOOKING', 'VIEW_OWN_BOOKINGS', 'MAKE_PAYMENT');

-- Staff permissions (includes customer permissions + staff-specific)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'STAFF'
AND p.permission_name IN (
    'BOOK_TICKET', 'CANCEL_OWN_BOOKING', 'VIEW_OWN_BOOKINGS', 'MAKE_PAYMENT',
    'VIEW_ALL_BOOKINGS', 'CANCEL_ANY_BOOKING', 'VIEW_SEAT_CHART', 
    'MANAGE_TRAIN_SCHEDULES', 'VIEW_REPORTS'
);

-- Admin permissions (all permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'ADMIN';

-- =====================================================
-- Travel Classes (5 classes)
-- =====================================================
INSERT INTO travel_class (class_code, class_name, is_ac, seats_per_coach, base_fare_per_km, reservation_charge) VALUES
('1A', 'First AC', TRUE, 18, 5.50, 50.00),
('2A', 'Second AC', TRUE, 48, 3.50, 40.00),
('3A', 'Third AC', TRUE, 64, 2.50, 40.00),
('SL', 'Sleeper', FALSE, 72, 1.20, 20.00),
('2S', 'Second Sitting', FALSE, 108, 0.80, 15.00);

-- =====================================================
-- Quotas (4 quotas)
-- =====================================================
INSERT INTO quota (quota_code, quota_name, fare_multiplier, description) VALUES
('GN', 'General', 1.0, 'Regular booking quota'),
('TK', 'Tatkal', 1.3, 'Emergency booking quota with higher fare'),
('LD', 'Ladies', 1.0, 'Reserved for ladies'),
('SR', 'Senior', 1.0, 'Reserved for senior citizens');

-- =====================================================
-- Concession Rules (3 rules)
-- =====================================================
INSERT INTO concession_rule (concession_name, eligibility_rule, discount_type, discount_value, description) VALUES
('Senior Citizen', 'Age >= 60', 'PERCENTAGE', 40.0, 'Discount for passengers aged 60 and above'),
('Child', 'Age >= 5 AND Age <= 11', 'PERCENTAGE', 50.0, 'Discount for children aged 5-11'),
('Disabled', 'Has disability certificate', 'PERCENTAGE', 75.0, 'Discount for passengers with disabilities');

-- =====================================================
-- Stations (10 major stations)
-- =====================================================
INSERT INTO station (station_code, station_name, city, state) VALUES
('NDLS', 'New Delhi', 'New Delhi', 'Delhi'),
('BCT', 'Mumbai Central', 'Mumbai', 'Maharashtra'),
('MAS', 'Chennai Central', 'Chennai', 'Tamil Nadu'),
('CSMT', 'Chhatrapati Shivaji Terminus', 'Mumbai', 'Maharashtra'),
('HWH', 'Howrah Junction', 'Howrah', 'West Bengal'),
('BLR', 'Bangalore City', 'Bangalore', 'Karnataka'),
('PUNE', 'Pune Junction', 'Pune', 'Maharashtra'),
('JP', 'Jaipur Junction', 'Jaipur', 'Rajasthan'),
('LKO', 'Lucknow', 'Lucknow', 'Uttar Pradesh'),
('AMD', 'Ahmedabad Junction', 'Ahmedabad', 'Gujarat');

-- =====================================================
-- Trains (3 trains)
-- =====================================================
INSERT INTO train (train_no, train_name, train_type) VALUES
('12301', 'Rajdhani Express', 'Express'),
('12951', 'Mumbai Rajdhani', 'Express'),
('12621', 'Tamil Nadu Express', 'Express');

-- =====================================================
-- Routes (3 routes)
-- =====================================================
INSERT INTO route (route_code, route_name) VALUES
('DEL-MUM-001', 'Delhi-Mumbai Route'),
('DEL-CHN-001', 'Delhi-Chennai Route'),
('MUM-PUN-001', 'Mumbai-Pune Route');

-- =====================================================
-- Route Stations
-- =====================================================
-- Route 1: Delhi -> Jaipur -> Ahmedabad -> Mumbai (12301)
INSERT INTO route_station (route_id, stop_seq, station_code, distance_km, arrival_offset, departure_offset, day_offset) VALUES
(1, 1, 'NDLS', 0, NULL, 0, 0),
(1, 2, 'JP', 280, 300, 310, 0),
(1, 3, 'AMD', 950, 660, 670, 0),
(1, 4, 'BCT', 1385, 1020, 1020, 0);

-- Route 2: Delhi -> Lucknow -> Howrah -> Chennai (12621)
INSERT INTO route_station (route_id, stop_seq, station_code, distance_km, arrival_offset, departure_offset, day_offset) VALUES
(2, 1, 'NDLS', 0, NULL, 0, 0),
(2, 2, 'LKO', 485, 360, 370, 0),
(2, 3, 'HWH', 1200, 900, 910, 0),
(2, 4, 'MAS', 2700, 2100, 2100, 1);

-- Route 3: Mumbai -> Pune (12951)
INSERT INTO route_station (route_id, stop_seq, station_code, distance_km, arrival_offset, departure_offset, day_offset) VALUES
(3, 1, 'CSMT', 0, NULL, 0, 0),
(3, 2, 'PUNE', 192, 180, 180, 0);

-- =====================================================
-- Train Schedules
-- =====================================================
-- Rajdhani runs Delhi-Mumbai on all days
INSERT INTO train_schedule (train_no, run_day, route_id) VALUES
('12301', 'Monday', 1),
('12301', 'Tuesday', 1),
('12301', 'Wednesday', 1),
('12301', 'Thursday', 1),
('12301', 'Friday', 1),
('12301', 'Saturday', 1),
('12301', 'Sunday', 1);

-- Tamil Nadu Express runs Delhi-Chennai on all days
INSERT INTO train_schedule (train_no, run_day, route_id) VALUES
('12621', 'Monday', 2),
('12621', 'Tuesday', 2),
('12621', 'Wednesday', 2),
('12621', 'Thursday', 2),
('12621', 'Friday', 2),
('12621', 'Saturday', 2),
('12621', 'Sunday', 2);

-- Mumbai-Pune runs on all days
INSERT INTO train_schedule (train_no, run_day, route_id) VALUES
('12951', 'Monday', 3),
('12951', 'Tuesday', 3),
('12951', 'Wednesday', 3),
('12951', 'Thursday', 3),
('12951', 'Friday', 3),
('12951', 'Saturday', 3),
('12951', 'Sunday', 3);

-- =====================================================
-- Train Runs (Next 10 days for each train)
-- =====================================================
-- Generate train runs for the next 10 days
DO $$
DECLARE
    train_rec RECORD;
    day_offset INTEGER;
    run_date DATE;
BEGIN
    FOR train_rec IN SELECT train_no FROM train LOOP
        FOR day_offset IN 0..9 LOOP
            run_date := CURRENT_DATE + day_offset;
            INSERT INTO train_run (train_no, run_date)
            VALUES (train_rec.train_no, run_date);
        END LOOP;
    END LOOP;
END $$;

-- =====================================================
-- Train Coaches and Seats
-- =====================================================
-- For train 12301 (Rajdhani), add coaches and seats
DO $$
DECLARE
    coach_count INTEGER;
    seat_count INTEGER;
    coach_no VARCHAR(5);
    berth_no VARCHAR(5);
BEGIN
    -- 1A coaches (2 coaches, 18 seats each)
    FOR coach_count IN 1..2 LOOP
        coach_no := 'A' || coach_count::TEXT;
        INSERT INTO train_coach (train_no, class_code, coach_no)
        VALUES ('12301', '1A', coach_no);
        
        FOR seat_count IN 1..18 LOOP
            berth_no := seat_count::TEXT;
            INSERT INTO seat (train_no, coach_no, berth_no)
            VALUES ('12301', coach_no, berth_no);
        END LOOP;
    END LOOP;
    
    -- 2A coaches (3 coaches, 48 seats each)
    FOR coach_count IN 1..3 LOOP
        coach_no := 'B' || coach_count::TEXT;
        INSERT INTO train_coach (train_no, class_code, coach_no)
        VALUES ('12301', '2A', coach_no);
        
        FOR seat_count IN 1..48 LOOP
            berth_no := seat_count::TEXT;
            INSERT INTO seat (train_no, coach_no, berth_no)
            VALUES ('12301', coach_no, berth_no);
        END LOOP;
    END LOOP;
    
    -- 3A coaches (4 coaches, 64 seats each)
    FOR coach_count IN 1..4 LOOP
        coach_no := 'S' || coach_count::TEXT;
        INSERT INTO train_coach (train_no, class_code, coach_no)
        VALUES ('12301', '3A', coach_no);
        
        FOR seat_count IN 1..64 LOOP
            berth_no := seat_count::TEXT;
            INSERT INTO seat (train_no, coach_no, berth_no)
            VALUES ('12301', coach_no, berth_no);
        END LOOP;
    END LOOP;
END $$;

-- For train 12621 (Tamil Nadu Express), add coaches
DO $$
DECLARE
    coach_count INTEGER;
    seat_count INTEGER;
    coach_no VARCHAR(5);
    berth_no VARCHAR(5);
BEGIN
    -- 2A coaches (2 coaches, 48 seats each)
    FOR coach_count IN 1..2 LOOP
        coach_no := 'A' || coach_count::TEXT;
        INSERT INTO train_coach (train_no, class_code, coach_no)
        VALUES ('12621', '2A', coach_no);
        
        FOR seat_count IN 1..48 LOOP
            berth_no := seat_count::TEXT;
            INSERT INTO seat (train_no, coach_no, berth_no)
            VALUES ('12621', coach_no, berth_no);
        END LOOP;
    END LOOP;
    
    -- SL coaches (5 coaches, 72 seats each)
    FOR coach_count IN 1..5 LOOP
        coach_no := 'S' || coach_count::TEXT;
        INSERT INTO train_coach (train_no, class_code, coach_no)
        VALUES ('12621', 'SL', coach_no);
        
        FOR seat_count IN 1..72 LOOP
            berth_no := seat_count::TEXT;
            INSERT INTO seat (train_no, coach_no, berth_no)
            VALUES ('12621', coach_no, berth_no);
        END LOOP;
    END LOOP;
END $$;

-- For train 12951 (Mumbai-Pune), add coaches
DO $$
DECLARE
    coach_count INTEGER;
    seat_count INTEGER;
    coach_no VARCHAR(5);
    berth_no VARCHAR(5);
BEGIN
    -- 2S coaches (8 coaches, 108 seats each)
    FOR coach_count IN 1..8 LOOP
        coach_no := 'D' || coach_count::TEXT;
        INSERT INTO train_coach (train_no, class_code, coach_no)
        VALUES ('12951', '2S', coach_no);
        
        FOR seat_count IN 1..108 LOOP
            berth_no := seat_count::TEXT;
            INSERT INTO seat (train_no, coach_no, berth_no)
            VALUES ('12951', coach_no, berth_no);
        END LOOP;
    END LOOP;
END $$;

-- =====================================================
-- Test Users (3 users, one per role)
-- =====================================================
-- Customer user
INSERT INTO users (role_id, email, password_hash, name, phone, status)
SELECT role_id, 'customer@test.com', 
    '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJK',  -- Bcrypt hash placeholder
    'Test Customer', '9876543210', 'ACTIVE'
FROM roles WHERE role_name = 'CUSTOMER';

-- Staff user
INSERT INTO users (role_id, email, password_hash, name, phone, status)
SELECT role_id, 'staff@railway.com',
    '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJK',
    'Test Staff Member', '9876543211', 'ACTIVE'
FROM roles WHERE role_name = 'STAFF';

-- Admin user
INSERT INTO users (role_id, email, password_hash, name, phone, status)
SELECT role_id, 'admin@railway.com',
    '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJK',
    'System Administrator', '9876543212', 'ACTIVE'
FROM roles WHERE role_name = 'ADMIN';

-- Add staff record for staff user
INSERT INTO staff (user_id, department, location, joined_at)
SELECT user_id, 'Operations', 'New Delhi', '2020-01-15'
FROM users WHERE email = 'staff@railway.com';

-- =====================================================
-- Summary
-- =====================================================
-- Display seed data summary
DO $$
DECLARE
    role_count INTEGER;
    permission_count INTEGER;
    station_count INTEGER;
    train_count INTEGER;
    route_count INTEGER;
    run_count INTEGER;
    coach_count INTEGER;
    seat_count INTEGER;
    user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO role_count FROM roles;
    SELECT COUNT(*) INTO permission_count FROM permissions;
    SELECT COUNT(*) INTO station_count FROM station;
    SELECT COUNT(*) INTO train_count FROM train;
    SELECT COUNT(*) INTO route_count FROM route;
    SELECT COUNT(*) INTO run_count FROM train_run;
    SELECT COUNT(*) INTO coach_count FROM train_coach;
    SELECT COUNT(*) INTO seat_count FROM seat;
    SELECT COUNT(*) INTO user_count FROM users;
    
    RAISE NOTICE '===== Seed Data Summary =====';
    RAISE NOTICE 'Roles: %', role_count;
    RAISE NOTICE 'Permissions: %', permission_count;
    RAISE NOTICE 'Stations: %', station_count;
    RAISE NOTICE 'Trains: %', train_count;
    RAISE NOTICE 'Routes: %', route_count;
    RAISE NOTICE 'Train Runs: %', run_count;
    RAISE NOTICE 'Train Coaches: %', coach_count;
    RAISE NOTICE 'Seats: %', seat_count;
    RAISE NOTICE 'Users: %', user_count;
    RAISE NOTICE '============================';
END $$;

-- =====================================================
-- Migration complete
-- =====================================================
