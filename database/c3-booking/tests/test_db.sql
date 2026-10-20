-- =====================================================================
-- C3 database tests. Expects database/setup.sh to have built the
-- database with dev data (C1 + C3 scripts and seeds).
-- Everything runs inside one transaction and is ROLLED BACK, so the
-- database is unchanged afterwards. Any failure aborts with an error.
--   psql -d railway -v ON_ERROR_STOP=1 -f tests/test_db.sql
-- =====================================================================
\set QUIET on
BEGIN;
SET LOCAL client_min_messages = notice;

-- helper: run SQL, require it to fail with the given SQLSTATE and, when
-- given, the given constraint name (so a test can't pass on the wrong rule)
CREATE FUNCTION pg_temp.expect_error(label TEXT, stmt TEXT, want TEXT, want_constraint TEXT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    got_constraint TEXT;
BEGIN
    BEGIN
        EXECUTE stmt;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS got_constraint = CONSTRAINT_NAME;
        IF SQLSTATE = want AND (want_constraint IS NULL OR got_constraint = want_constraint) THEN
            RAISE NOTICE 'PASS  %', label;
            RETURN;
        END IF;
        RAISE EXCEPTION 'FAIL  % — expected SQLSTATE % %, got % % (%)', label, want,
            coalesce(want_constraint, ''), SQLSTATE, coalesce(got_constraint, ''), SQLERRM;
    END;
    RAISE EXCEPTION 'FAIL  % — statement succeeded but should have failed', label;
END $$;

-- helper: require a boolean to be true ---------------------------------------
CREATE FUNCTION pg_temp.expect(label TEXT, ok BOOLEAN) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF ok IS TRUE THEN RAISE NOTICE 'PASS  %', label;
    ELSE RAISE EXCEPTION 'FAIL  %', label; END IF;
END $$;

-- ------------------------------------------------------------- structure
SELECT pg_temp.expect('structure: all 14 C3 tables exist',
    (SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
        'station','train','travel_class','route','route_station','train_schedule',
        'train_run','train_coach','seat','quota','concession_rule',
        'booking','passenger','seat_allocation')) = 14);
SELECT pg_temp.expect('structure: C3 does not create identity or payment tables of its own',
    NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public'
                AND tablename IN ('payment','payment_transaction','refund')));
SELECT pg_temp.expect('structure: booking.user_id references C1 users',
    EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_booking_user'
            AND confrelid = 'users'::regclass));

-- ------------------------------------------------------------- seed data
SELECT pg_temp.expect('seed: 5 travel classes', (SELECT count(*) FROM travel_class) = 5);
SELECT pg_temp.expect('seed: 4 quotas',         (SELECT count(*) FROM quota) = 4);
SELECT pg_temp.expect('seed: 3 trains, 3 routes',
    (SELECT count(*) FROM train) = 3 AND (SELECT count(*) FROM route) = 3);
SELECT pg_temp.expect('seed: every train has a schedule for all 7 weekdays',
    NOT EXISTS (SELECT 1 FROM train t
                WHERE (SELECT count(*) FROM train_schedule s WHERE s.train_no = t.train_no) <> 7));
SELECT pg_temp.expect('seed: 30 runs per train starting today',
    NOT EXISTS (SELECT 1 FROM train t
                WHERE (SELECT count(*) FROM train_run r
                       WHERE r.train_no = t.train_no AND r.run_date >= CURRENT_DATE) <> 30));
SELECT pg_temp.expect('seed: every coach has seats_per_coach seats',
    NOT EXISTS (SELECT 1 FROM train_coach tc JOIN travel_class c USING (class_code)
                WHERE (SELECT count(*) FROM seat s
                       WHERE s.train_no = tc.train_no AND s.coach_no = tc.coach_no) <> c.seats_per_coach));
SELECT pg_temp.expect('seed: every seat has a berth type',
    NOT EXISTS (SELECT 1 FROM seat WHERE berth_type IS NULL));
SELECT pg_temp.expect('seed: route stops are numbered 1..n with increasing distance',
    NOT EXISTS (SELECT 1 FROM (
        SELECT stop_seq, row_number() OVER w AS rn,
               distance_km, lag(distance_km) OVER w AS prev_km
        FROM route_station WINDOW w AS (PARTITION BY route_id ORDER BY stop_seq)) x
        WHERE stop_seq <> rn OR distance_km <= prev_km));

-- ---------------------------------------------------- fixtures for writes
-- One booking on the first Rajdhani run, NDLS (1) -> BCT (4), for customer@example.com
CREATE TEMP TABLE fx AS
SELECT (SELECT user_id FROM users WHERE email = 'customer@example.com') AS user_id,
       (SELECT run_id FROM train_run WHERE train_no = '12952' ORDER BY run_date LIMIT 1) AS run_id,
       (SELECT seat_id FROM seat WHERE train_no = '12952' AND coach_no = 'B1' AND berth_no = '1') AS seat_id;

INSERT INTO booking (pnr, user_id, run_id, class_code, quota_code, from_seq, to_seq, total_fare, status, hold_expires_at)
SELECT 'T000000001', user_id, run_id, '3A', 'GN', 1, 4, 3500, 'HELD', now() + interval '15 minutes' FROM fx;
INSERT INTO passenger (pnr, name, age, gender, status, passenger_fare)
VALUES ('T000000001', 'Asha Rao', 34, 'F', 'CONFIRMED', 3500);
INSERT INTO seat_allocation (passenger_id, seat_id, run_id, from_seq, to_seq)
SELECT currval('passenger_passenger_id_seq'), seat_id, run_id, 1, 4 FROM fx;

-- ------------------------------------------------------------- booking
SELECT pg_temp.expect_error('booking: duplicate PNR rejected',
    format('INSERT INTO booking (pnr,user_id,run_id,class_code,quota_code,from_seq,to_seq,total_fare,hold_expires_at)
            SELECT %L,user_id,run_id,%L,%L,1,4,100,now() FROM fx', 'T000000001', '3A', 'GN'), '23505', 'booking_pkey');
SELECT pg_temp.expect_error('booking: unknown user rejected (FK)',
    format('INSERT INTO booking (pnr,user_id,run_id,class_code,quota_code,from_seq,to_seq,total_fare,hold_expires_at)
            SELECT %L,999999,run_id,%L,%L,1,4,100,now() FROM fx', 'T000000002', '3A', 'GN'), '23503', 'fk_booking_user');
SELECT pg_temp.expect_error('booking: unknown quota rejected (FK)',
    format('INSERT INTO booking (pnr,user_id,run_id,class_code,quota_code,from_seq,to_seq,total_fare,hold_expires_at)
            SELECT %L,user_id,run_id,%L,%L,1,4,100,now() FROM fx', 'T000000002', '3A', 'XX'), '23503', 'fk_booking_quota');
SELECT pg_temp.expect_error('booking: from_seq must be before to_seq',
    format('INSERT INTO booking (pnr,user_id,run_id,class_code,quota_code,from_seq,to_seq,total_fare,hold_expires_at)
            SELECT %L,user_id,run_id,%L,%L,3,2,100,now() FROM fx', 'T000000002', '3A', 'GN'), '23514', 'chk_booking_segment');
SELECT pg_temp.expect_error('booking: negative total fare rejected',
    format('INSERT INTO booking (pnr,user_id,run_id,class_code,quota_code,from_seq,to_seq,total_fare,hold_expires_at)
            SELECT %L,user_id,run_id,%L,%L,1,4,-1,now() FROM fx', 'T000000002', '3A', 'GN'), '23514', 'chk_booking_total_fare');
SELECT pg_temp.expect_error('booking: HELD needs hold_expires_at',
    format('INSERT INTO booking (pnr,user_id,run_id,class_code,quota_code,from_seq,to_seq,total_fare)
            SELECT %L,user_id,run_id,%L,%L,1,4,100 FROM fx', 'T000000002', '3A', 'GN'), '23514', 'chk_booking_hold_expiry');
SELECT pg_temp.expect_error('booking: CONFIRMED must not keep hold_expires_at',
    $$UPDATE booking SET status = 'CONFIRMED' WHERE pnr = 'T000000001'$$, '23514', 'chk_booking_hold_expiry');
SELECT pg_temp.expect_error('booking: unknown status rejected (enum)',
    $$UPDATE booking SET status = 'PAID' WHERE pnr = 'T000000001'$$, '22P02');
SELECT pg_temp.expect_error('booking: user with bookings cannot be deleted',
    $$DELETE FROM users WHERE email = 'customer@example.com'$$, '23503', 'fk_booking_user');

-- ------------------------------------------------------------- passenger
SELECT pg_temp.expect_error('passenger: age 0 rejected',
    $$INSERT INTO passenger (pnr,name,age,gender,status,passenger_fare) VALUES ('T000000001','X',0,'M','CONFIRMED',0)$$, '23514', 'chk_passenger_age');
SELECT pg_temp.expect_error('passenger: invalid gender rejected',
    $$INSERT INTO passenger (pnr,name,age,gender,status,passenger_fare) VALUES ('T000000001','X',30,'Z','CONFIRMED',0)$$, '23514', 'chk_passenger_gender');
SELECT pg_temp.expect_error('passenger: blank name rejected',
    $$INSERT INTO passenger (pnr,name,age,gender,status,passenger_fare) VALUES ('T000000001','  ',30,'M','CONFIRMED',0)$$, '23514', 'chk_passenger_name');
SELECT pg_temp.expect_error('passenger: WAITLIST needs a queue number',
    $$INSERT INTO passenger (pnr,name,age,gender,status,passenger_fare) VALUES ('T000000001','X',30,'M','WAITLIST',0)$$, '23514', 'chk_passenger_queue_no');
SELECT pg_temp.expect_error('passenger: CONFIRMED must not have a queue number',
    $$INSERT INTO passenger (pnr,name,age,gender,status,queue_no,passenger_fare) VALUES ('T000000001','X',30,'M','CONFIRMED',1,0)$$, '23514', 'chk_passenger_queue_no');
SELECT pg_temp.expect_error('passenger: CANCELLED needs cancelled_at',
    $$UPDATE passenger SET status = 'CANCELLED' WHERE pnr = 'T000000001'$$, '23514', 'chk_passenger_cancelled_at');
SELECT pg_temp.expect_error('passenger: unknown PNR rejected (FK)',
    $$INSERT INTO passenger (pnr,name,age,gender,status,passenger_fare) VALUES ('NOPE','X',30,'M','CONFIRMED',0)$$, '23503', 'fk_passenger_booking');

-- ------------------------------------------------------- seat_allocation
SELECT pg_temp.expect_error('seat_allocation: one allocation per passenger',
    $$INSERT INTO seat_allocation (passenger_id, seat_id, run_id, from_seq, to_seq)
      SELECT p.passenger_id, fx.seat_id + 1, fx.run_id, 1, 4 FROM passenger p, fx WHERE p.pnr = 'T000000001'$$, '23505', 'seat_allocation_passenger_id_key');
SELECT pg_temp.expect_error('seat_allocation: seat in use cannot be deleted',
    $$DELETE FROM seat WHERE seat_id = (SELECT seat_id FROM fx)$$, '23503', 'fk_seat_allocation_seat');

-- ------------------------------------------------------------- cascades
DELETE FROM booking WHERE pnr = 'T000000001';
SELECT pg_temp.expect('cascade: deleting a booking removes its passengers and seat allocations',
    NOT EXISTS (SELECT 1 FROM passenger WHERE pnr = 'T000000001')
    AND NOT EXISTS (SELECT 1 FROM seat_allocation sa, fx WHERE sa.seat_id = fx.seat_id));

ROLLBACK;
