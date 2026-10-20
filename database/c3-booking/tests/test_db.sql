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

-- =====================================================================
-- Phase 1: functions, triggers, procedures, views
-- =====================================================================

-- helper: JSON array of n adult passengers
CREATE FUNCTION pg_temp.pax(n INTEGER, age INTEGER DEFAULT 30) RETURNS JSONB
LANGUAGE sql AS $$
    SELECT jsonb_agg(jsonb_build_object('name', 'Passenger ' || i, 'age', age, 'gender', 'M'))
    FROM generate_series(1, n) AS i
$$;

-- runs used below (each scenario gets its own run so they don't interact)
SELECT (SELECT user_id FROM users WHERE email = 'customer@example.com') AS uid,
       (SELECT user_id FROM users WHERE email = 'locked@example.com')   AS locked_uid,
       (SELECT run_id FROM train_run WHERE train_no = '12952' AND run_date = CURRENT_DATE + 5) AS raj5,
       (SELECT run_id FROM train_run WHERE train_no = '12952' AND run_date = CURRENT_DATE + 6) AS raj6,
       (SELECT run_id FROM train_run WHERE train_no = '12952' AND run_date = CURRENT_DATE + 8) AS raj8,
       (SELECT run_id FROM train_run WHERE train_no = '12622' AND run_date = CURRENT_DATE + 7) AS tn7
\gset

-- ------------------------------------------------------------------ PNR
SELECT generate_pnr() AS new_pnr \gset
SELECT pg_temp.expect('pnr: generated PNR is 10 digits with a valid check digit', is_valid_pnr(:'new_pnr'));
SELECT pg_temp.expect('pnr: changing one digit breaks the check digit',
    NOT is_valid_pnr(left(:'new_pnr', 4) || ((substr(:'new_pnr', 5, 1)::INTEGER + 1) % 10) || right(:'new_pnr', 5)));
SELECT pg_temp.expect('pnr: non-digit and wrong-length input is invalid',
    NOT is_valid_pnr('12345ABCDE') AND NOT is_valid_pnr('123') AND NOT is_valid_pnr(NULL));

-- ------------------------------------------------------- route and fares
SELECT pg_temp.expect('route: run is mapped to its route by weekday',
    route_of_run(:raj5) = (SELECT route_id FROM route WHERE route_code = 'NDLS-BCT'));
SELECT pg_temp.expect('route: journey_date adds the stop''s day offset',
    journey_date(:tn7, 4) = CURRENT_DATE + 8 AND journey_date(:tn7, 1) = CURRENT_DATE + 7);
SELECT pg_temp.expect('route: segment distance NDLS-BCT is 1384 km, KOTA-BRC 528 km',
    segment_distance(:raj5, 1, 4) = 1384 AND segment_distance(:raj5, 2, 3) = 528);
SELECT pg_temp.expect('fare: 3A general NDLS-BCT = 1384 x 2.50 + 40 = 3500',
    calc_fare(:raj5, '3A', 'GN', 1, 4) = 3500.00);
SELECT pg_temp.expect('fare: tatkal multiplies the distance fare by 1.3 (4538)',
    calc_fare(:raj5, '3A', 'TK', 1, 4) = 4538.00);
SELECT pg_temp.expect('fare: 40% senior concession applies to the distance fare only (2116)',
    calc_fare(:raj5, '3A', 'GN', 1, 4,
              (SELECT concession_id FROM concession_rule WHERE concession_name = 'Senior Citizen')) = 2116.00);
SELECT pg_temp.expect_error('fare: stops not on the route rejected',
    format('SELECT calc_fare(%s, %L, %L, 1, 9)', :raj5, '3A', 'GN'), '22023');
SELECT pg_temp.expect_error('fare: unknown concession rejected',
    format('SELECT calc_fare(%s, %L, %L, 1, 4, 999)', :raj5, '3A', 'GN'), '22023');
SELECT pg_temp.expect('rac: 3 x 3A coaches = 24 RAC places, 1A has none',
    rac_capacity(:raj5, '3A') = 24 AND rac_capacity(:raj5, '1A') = 0);

-- ------------------------------------------------ create_booking: errors
SELECT pg_temp.expect_error('create_booking: 7 passengers rejected',
    format('SELECT create_booking(%s, %s, %L, %L, 1, 4, %L)', :uid, :raj5, '3A', 'GN', pg_temp.pax(7)), '22023');
SELECT pg_temp.expect_error('create_booking: empty passenger list rejected',
    format('SELECT create_booking(%s, %s, %L, %L, 1, 4, %L)', :uid, :raj5, '3A', 'GN', '[]'), '22023');
SELECT pg_temp.expect_error('create_booking: passengers must be an array',
    format('SELECT create_booking(%s, %s, %L, %L, 1, 4, %L)', :uid, :raj5, '3A', 'GN', '{"name":"X"}'), '22023');
SELECT pg_temp.expect_error('create_booking: unknown run is not found',
    format('SELECT create_booking(%s, 999999, %L, %L, 1, 4, %L)', :uid, '3A', 'GN', pg_temp.pax(1)), 'P0002');
SELECT pg_temp.expect_error('create_booking: unknown user is not found',
    format('SELECT create_booking(999999, %s, %L, %L, 1, 4, %L)', :raj5, '3A', 'GN', pg_temp.pax(1)), 'P0002');
SELECT pg_temp.expect_error('create_booking: LOCKED user cannot book',
    format('SELECT create_booking(%s, %s, %L, %L, 1, 4, %L)', :locked_uid, :raj5, '3A', 'GN', pg_temp.pax(1)), '42501');
SELECT pg_temp.expect_error('create_booking: stops not on the route rejected',
    format('SELECT create_booking(%s, %s, %L, %L, 1, 9, %L)', :uid, :raj5, '3A', 'GN', pg_temp.pax(1)),
    '23514', 'trg_booking_valid_stops');
SELECT pg_temp.expect_error('create_booking: backwards journey rejected',
    format('SELECT create_booking(%s, %s, %L, %L, 3, 2, %L)', :uid, :raj5, '3A', 'GN', pg_temp.pax(1)),
    '23514', 'chk_booking_segment');
SELECT pg_temp.expect_error('create_booking: class the train does not have rejected',
    format('SELECT create_booking(%s, %s, %L, %L, 1, 4, %L)', :uid, :raj5, 'SL', 'GN', pg_temp.pax(1)),
    '23514', 'trg_booking_class_on_train');
SELECT pg_temp.expect_error('create_booking: invalid passenger (age 0) rejected',
    format('SELECT create_booking(%s, %s, %L, %L, 1, 4, %L)', :uid, :raj5, '3A', 'GN',
           '[{"name":"Baby","age":0,"gender":"F"}]'), '23514', 'chk_passenger_age');

INSERT INTO train_run (train_no, run_date, status) VALUES ('12127', CURRENT_DATE - 1, 'SCHEDULED');
SELECT pg_temp.expect_error('create_booking: train that already left rejected',
    format('SELECT create_booking(%s, %s, %L, %L, 1, 2, %L)', :uid,
           (SELECT run_id FROM train_run WHERE train_no = '12127' AND run_date = CURRENT_DATE - 1),
           '2S', 'GN', pg_temp.pax(1)), '55000');
UPDATE train_run SET status = 'CANCELLED' WHERE run_id = :raj8;
SELECT pg_temp.expect_error('create_booking: cancelled run rejected',
    format('SELECT create_booking(%s, %s, %L, %L, 1, 4, %L)', :uid, :raj8, '3A', 'GN', pg_temp.pax(1)), '55000');

-- --------------------------------- create_booking: seats, then waitlist (1A, no RAC)
SELECT create_booking(:uid, :raj5, '1A', 'GN', 1, 4, pg_temp.pax(6)) AS a1 \gset
SELECT create_booking(:uid, :raj5, '1A', 'GN', 1, 4, pg_temp.pax(6)) AS a2 \gset
SELECT create_booking(:uid, :raj5, '1A', 'GN', 1, 4, pg_temp.pax(6)) AS a3 \gset
SELECT create_booking(:uid, :raj5, '1A', 'GN', 1, 4, pg_temp.pax(2)) AS a4 \gset
SELECT pg_temp.expect('create_booking: returns valid PNRs, booking HELD for 15 minutes',
    is_valid_pnr(:'a1') AND (SELECT status = 'HELD' AND hold_expires_at = now() + interval '15 minutes'
                             FROM booking WHERE pnr = :'a1'));
SELECT pg_temp.expect('create_booking: all 18 1A berths confirmed, each to one passenger',
    (SELECT count(*) FROM seat_allocation WHERE run_id = :raj5) = 18
    AND (SELECT count(DISTINCT seat_id) FROM seat_allocation WHERE run_id = :raj5) = 18);
SELECT pg_temp.expect('create_booking: total_fare is the sum of passenger fares',
    (SELECT total_fare FROM booking WHERE pnr = :'a1') = 6 * calc_fare(:raj5, '1A', 'GN', 1, 4));
SELECT pg_temp.expect('create_booking: full class with no RAC puts passengers on the waitlist (WL 1, WL 2)',
    (SELECT string_agg(status_label, ',' ORDER BY passenger_no) FROM v_pnr_status WHERE pnr = :'a4') = 'WL 1,WL 2');
SELECT pg_temp.expect('availability: 0 seats, 2 waiting for 1A on that run',
    (SELECT available_seats = 0 AND waitlist_count = 2 FROM availability(:raj5, '1A', 1, 4)));

-- ------------------------------------------------- segment reuse (3A)
SELECT create_booking(:uid, :raj6, '3A', 'GN', 1, 2, pg_temp.pax(1)) AS s1 \gset
SELECT create_booking(:uid, :raj6, '3A', 'GN', 2, 4, pg_temp.pax(1)) AS s2 \gset
SELECT create_booking(:uid, :raj6, '3A', 'GN', 1, 4, pg_temp.pax(1)) AS s3 \gset
SELECT pg_temp.expect('segments: a berth left at KOTA is resold from KOTA onwards',
    (SELECT seat_id FROM seat_allocation sa JOIN passenger p USING (passenger_id) WHERE p.pnr = :'s1')
  = (SELECT seat_id FROM seat_allocation sa JOIN passenger p USING (passenger_id) WHERE p.pnr = :'s2'));
SELECT pg_temp.expect('segments: a full-journey booking does not get that berth',
    (SELECT seat_id FROM seat_allocation sa JOIN passenger p USING (passenger_id) WHERE p.pnr = :'s3')
  <> (SELECT seat_id FROM seat_allocation sa JOIN passenger p USING (passenger_id) WHERE p.pnr = :'s1'));
SELECT create_booking(:uid, :raj6, '3A', 'GN', 1, 4, pg_temp.pax(1, 70)) AS s4 \gset
SELECT pg_temp.expect('seats: senior citizen gets a lower berth',
    (SELECT berth_type FROM v_pnr_status WHERE pnr = :'s4') IN ('LB', 'SL'));

-- ------------------------------------------- trigger-enforced rules
SELECT pg_temp.expect_error('no double booking: overlapping allocation of the same seat rejected',
    format('UPDATE seat_allocation SET seat_id = (SELECT seat_id FROM seat_allocation sa JOIN passenger p USING (passenger_id) WHERE p.pnr = %L)
            WHERE passenger_id = (SELECT passenger_id FROM passenger WHERE pnr = %L)', :'s1', :'s3'),
    '23P01', 'excl_seat_allocation_no_overlap');
SELECT pg_temp.expect_error('max 6: a 7th passenger on a PNR rejected',
    format('INSERT INTO passenger (pnr,name,age,gender,status,queue_no,passenger_fare) VALUES (%L,%L,30,%L,%L,99,0)',
           :'a1', 'Seventh', 'M', 'WAITLIST'), '23514', 'trg_passenger_max_six');
SELECT confirm_booking(:'s1') \gset
SELECT pg_temp.expect_error('passengers cannot be added once a booking is CONFIRMED',
    format('INSERT INTO passenger (pnr,name,age,gender,status,queue_no,passenger_fare) VALUES (%L,%L,30,%L,%L,99,0)',
           :'s1', 'Late', 'M', 'WAITLIST'), '23514', 'trg_passenger_booking_held');
SELECT pg_temp.expect_error('booking: journey cannot be changed after booking',
    format('UPDATE booking SET to_seq = 3 WHERE pnr = %L', :'s3'), '23514', 'trg_booking_immutable');
SELECT pg_temp.expect_error('booking: CONFIRMED cannot go back to HELD',
    format('UPDATE booking SET status = %L, hold_expires_at = now() WHERE pnr = %L', 'HELD', :'s1'),
    '23514', 'trg_booking_status_flow');
SELECT pg_temp.expect_error('passenger: CONFIRMED cannot go back to WAITLIST',
    format('UPDATE passenger SET status = %L, queue_no = 5 WHERE pnr = %L', 'WAITLIST', :'s3'),
    '23514', 'trg_passenger_status_flow');
SELECT pg_temp.expect_error('allocation: segment must match the booking',
    format('UPDATE seat_allocation SET to_seq = 3 WHERE passenger_id = (SELECT passenger_id FROM passenger WHERE pnr = %L)', :'s3'),
    '23514', 'trg_seat_allocation_matches_booking');
SELECT pg_temp.expect_error('allocation: seat must be in the booked class',
    format('UPDATE seat_allocation SET seat_id = (SELECT seat_id FROM seat WHERE train_no = %L AND coach_no = %L AND berth_no = %L)
            WHERE passenger_id = (SELECT passenger_id FROM passenger WHERE pnr = %L)', '12952', 'H1', '1', :'s3'),
    '23514', 'trg_seat_allocation_matches_booking');
SELECT pg_temp.expect_error('allocation: waitlisted passenger cannot get a seat row',
    format('INSERT INTO seat_allocation (passenger_id, seat_id, run_id, from_seq, to_seq)
            SELECT p.passenger_id, (SELECT seat_id FROM seat WHERE train_no = %L AND coach_no = %L AND berth_no = %L), %s, 1, 4
            FROM passenger p WHERE p.pnr = %L LIMIT 1', '12952', 'H1', '1', :raj5, :'a4'),
    '23514', 'trg_seat_allocation_confirmed_only');
SELECT pg_temp.expect_error('deferred: CONFIRMED passenger without a seat is caught at commit',
    format($f$DO $x$ BEGIN
                DELETE FROM seat_allocation WHERE passenger_id = (SELECT passenger_id FROM passenger WHERE pnr = %L);
                SET CONSTRAINTS chk_confirmed_has_seat IMMEDIATE;
              END $x$$f$, :'s3'),
    '23514', 'chk_confirmed_has_seat');
UPDATE passenger SET passenger_fare = passenger_fare + 10 WHERE pnr = :'s3';
SELECT pg_temp.expect('total_fare follows passenger fare changes',
    (SELECT total_fare FROM booking WHERE pnr = :'s3') = calc_fare(:raj6, '3A', 'GN', 1, 4) + 10);

-- ----------------------------------------------------- confirm_booking
SELECT confirm_booking(:'a1') AS paid \gset
SELECT pg_temp.expect('confirm_booking: HELD -> CONFIRMED, returns the fare, clears the hold',
    :paid = (SELECT total_fare FROM booking WHERE pnr = :'a1')
    AND (SELECT status = 'CONFIRMED' AND hold_expires_at IS NULL FROM booking WHERE pnr = :'a1'));
SELECT pg_temp.expect('confirm_booking: calling it again is harmless',
    confirm_booking(:'a1') = (SELECT total_fare FROM booking WHERE pnr = :'a1'));
SELECT pg_temp.expect_error('confirm_booking: unknown PNR not found',
    $$SELECT confirm_booking('0000000000')$$, 'P0002');
UPDATE booking SET hold_expires_at = now() - interval '1 minute' WHERE pnr = :'a2';
SELECT pg_temp.expect_error('confirm_booking: expired hold rejected',
    format('SELECT confirm_booking(%L)', :'a2'), '55000');

-- ------------------------------- RAC and waitlist promotion (12622 2A: 48 berths, 4 RAC)
SELECT create_booking(:uid, :tn7, '2A', 'GN', 1, 4, pg_temp.pax(6)) AS r1 \gset
SELECT create_booking(:uid, :tn7, '2A', 'GN', 1, 4, pg_temp.pax(6)) FROM generate_series(2, 8) \g /dev/null
SELECT create_booking(:uid, :tn7, '2A', 'GN', 1, 4, pg_temp.pax(6)) AS r9 \gset
SELECT pg_temp.expect('rac: when berths run out the next 4 get RAC, the rest wait',
    (SELECT string_agg(status_label, ',' ORDER BY passenger_no) FROM v_pnr_status WHERE pnr = :'r9')
    = 'RAC 1,RAC 2,RAC 3,RAC 4,WL 1,WL 2');

SELECT * FROM cancel_passengers(:'r1',
    ARRAY[(SELECT min(passenger_id) FROM passenger WHERE pnr = :'r1')]) AS c \gset c_
SELECT pg_temp.expect('cancel: returns the cancelled passenger, unpaid booking',
    :'c_previous_status' = 'CONFIRMED' AND :'c_booking_was_paid' = 'f');
SELECT pg_temp.expect('promotion: RAC 1 gets the freed berth, WL 1 moves to RAC, the queue moves up',
    (SELECT string_agg(status_label, ',' ORDER BY passenger_no) FROM v_pnr_status WHERE pnr = :'r9')
    LIKE 'CNF/A1/%,RAC 1,RAC 2,RAC 3,RAC 4,WL 1');
SELECT pg_temp.expect('cancel: a partly cancelled booking stays HELD with 5 active passengers',
    (SELECT status = 'HELD' AND active_passengers = 5 FROM v_user_bookings WHERE pnr = :'r1'));
SELECT pg_temp.expect('queues: no two active passengers share a queue number',
    NOT EXISTS (SELECT 1 FROM passenger p JOIN booking b USING (pnr)
                WHERE p.status IN ('RAC', 'WAITLIST') AND b.status IN ('HELD', 'CONFIRMED')
                GROUP BY b.run_id, b.class_code, b.quota_code, p.status, p.queue_no HAVING count(*) > 1));

SELECT count(*) AS n FROM cancel_passengers(:'r1') \gset
SELECT pg_temp.expect('cancel whole PNR: remaining 5 cancelled, booking CANCELLED, 5 more promoted',
    :n = 5 AND (SELECT status = 'CANCELLED' FROM booking WHERE pnr = :'r1')
    AND (SELECT count(*) FROM passenger WHERE pnr = :'r9' AND status = 'CONFIRMED') = 6);
SELECT pg_temp.expect_error('cancel: already cancelled booking rejected',
    format('SELECT * FROM cancel_passengers(%L)', :'r1'), '55000');
SELECT pg_temp.expect_error('cancel: passenger from another PNR rejected',
    format('SELECT * FROM cancel_passengers(%L, ARRAY[(SELECT min(passenger_id) FROM passenger WHERE pnr = %L)])', :'r9', :'a1'),
    '22023');

-- ------------------------------------------------------- expire_holds
CALL expire_holds(NULL);
SELECT pg_temp.expect('expire_holds: the expired hold becomes EXPIRED, its seats go to the waitlist',
    (SELECT status = 'EXPIRED' FROM booking WHERE pnr = :'a2')
    AND NOT EXISTS (SELECT 1 FROM passenger WHERE pnr = :'a2' AND status <> 'CANCELLED')
    AND (SELECT count(*) FROM passenger WHERE pnr = :'a4' AND status = 'CONFIRMED') = 2);
SELECT pg_temp.expect('expire_holds: bookings still within their hold are untouched',
    (SELECT status FROM booking WHERE pnr = :'a3') = 'HELD');
SELECT pg_temp.expect_error('expired booking cannot be cancelled',
    format('SELECT * FROM cancel_passengers(%L)', :'a2'), '55000');

-- --------------------------------------------- consistency at "commit"
SET CONSTRAINTS ALL IMMEDIATE;
SELECT pg_temp.expect('deferred checks pass: every CONFIRMED passenger has exactly one seat', TRUE);

ROLLBACK;
