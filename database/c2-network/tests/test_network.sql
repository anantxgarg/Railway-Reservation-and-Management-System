-- =====================================================================
-- C2 network tests. Expects database/setup.sh to have built the
-- database with dev data. Everything runs inside one transaction and is
-- ROLLED BACK. Any failure aborts with an error.
--   psql -d railway -v ON_ERROR_STOP=1 -f tests/test_network.sql
-- =====================================================================
\set QUIET on
BEGIN;
SET LOCAL client_min_messages = notice;

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

CREATE FUNCTION pg_temp.expect(label TEXT, ok BOOLEAN) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF ok IS TRUE THEN RAISE NOTICE 'PASS  %', label;
    ELSE RAISE EXCEPTION 'FAIL  %', label; END IF;
END $$;

-- ------------------------------------------------------------- structure
SELECT pg_temp.expect('structure: all 9 network tables exist',
    (SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
        'station','train','travel_class','route','route_station','train_schedule',
        'train_run','train_coach','seat')) = 9);

-- ------------------------------------------------------------- seed data
SELECT pg_temp.expect('seed: 6 travel classes, including CC', (SELECT count(*) FROM travel_class) = 6
    AND EXISTS (SELECT 1 FROM travel_class WHERE class_code = 'CC'));
SELECT pg_temp.expect('seed: 12 stations', (SELECT count(*) FROM station) = 12);
SELECT pg_temp.expect('seed: 6 trains, 6 routes',
    (SELECT count(*) FROM train) = 6 AND (SELECT count(*) FROM route) = 6);
SELECT pg_temp.expect('seed: daily trains have all 7 weekdays, 11139 and 16535 three each',
    (SELECT count(*) FROM train_schedule WHERE train_no IN ('12952','12622','12127','12128')) = 28
    AND (SELECT count(*) FROM train_schedule WHERE train_no = '11139') = 3
    AND (SELECT count(*) FROM train_schedule WHERE train_no = '16535') = 3);
SELECT pg_temp.expect('seed: a run on every scheduled day of the next 30 days, and on no other day',
    NOT EXISTS (SELECT 1 FROM train t
                WHERE (SELECT count(*) FROM train_run r
                       WHERE r.train_no = t.train_no AND r.run_date >= CURRENT_DATE)
                   <> (SELECT count(*) FROM generate_series(0, 29) g(day)
                       JOIN train_schedule s ON s.train_no = t.train_no
                                            AND s.run_day = to_char(CURRENT_DATE + g.day, 'FMDay'))));
SELECT pg_temp.expect('seed: every train has coaches',
    NOT EXISTS (SELECT 1 FROM train t WHERE NOT EXISTS (SELECT 1 FROM train_coach c WHERE c.train_no = t.train_no)));
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
SELECT pg_temp.expect('seed: new runs are SCHEDULED and on time',
    NOT EXISTS (SELECT 1 FROM train_run WHERE status <> 'SCHEDULED' OR delay_minutes <> 0));

-- ------------------------------------------------------- column rules
SELECT pg_temp.expect_error('train_run: unknown status rejected',
    $$UPDATE train_run SET status = 'LATE' WHERE train_no = '12952'$$, '23514', 'chk_train_run_status');
SELECT pg_temp.expect_error('train_run: negative delay rejected',
    $$UPDATE train_run SET delay_minutes = -5 WHERE train_no = '12952'$$, '23514', 'chk_train_run_delay');
SELECT pg_temp.expect_error('train_schedule: abbreviated weekday rejected (full names only)',
    $$INSERT INTO train_schedule (train_no, run_day, route_id)
      SELECT '11139', 'TUE', route_id FROM route WHERE route_code = 'PUNE-SUR'$$, '23514', 'chk_train_schedule_run_day');
SELECT pg_temp.expect_error('route: departure time is required',
    $$INSERT INTO route (route_code, route_name) VALUES ('X-Y', 'X to Y')$$, '23502');

-- ------------------------------------------------- trg_validate_route_sequence
INSERT INTO route (route_code, route_name, departure_time) VALUES ('TEST', 'Test route', '22:00');
INSERT INTO route_station (route_id, stop_seq, station_code, distance_km, arrival_offset, departure_offset)
SELECT route_id, 1, 'PUNE', 0, NULL, 0 FROM route WHERE route_code = 'TEST';

SELECT pg_temp.expect_error('route sequence: a stop no farther than the previous one is rejected',
    $$INSERT INTO route_station (route_id, stop_seq, station_code, distance_km, arrival_offset, departure_offset)
      SELECT route_id, 2, 'SUR', 0, 60, 65 FROM route WHERE route_code = 'TEST'$$,
    '23514', 'trg_validate_route_sequence');
SELECT pg_temp.expect_error('route sequence: departing a stop before arriving is rejected',
    $$INSERT INTO route_station (route_id, stop_seq, station_code, distance_km, arrival_offset, departure_offset)
      SELECT route_id, 2, 'SUR', 262, 60, 50 FROM route WHERE route_code = 'TEST'$$,
    '23514', 'trg_validate_route_sequence');

-- 22:00 + 180 min = 01:00 the next day
INSERT INTO route_station (route_id, stop_seq, station_code, distance_km, arrival_offset, departure_offset, day_offset)
SELECT route_id, 2, 'SUR', 262, 180, 185, 0 FROM route WHERE route_code = 'TEST';
SELECT pg_temp.expect('route sequence: day_offset is worked out from the times (typed 0, stored 1)',
    (SELECT day_offset FROM route_station rs JOIN route r USING (route_id)
     WHERE r.route_code = 'TEST' AND rs.stop_seq = 2) = 1);

UPDATE route SET departure_time = '08:00' WHERE route_code = 'TEST';
SELECT pg_temp.expect('route sequence: an earlier departure time moves the stop back to day 0',
    (SELECT day_offset FROM route_station rs JOIN route r USING (route_id)
     WHERE r.route_code = 'TEST' AND rs.stop_seq = 2) = 0);

-- ------------------------------------------------------------- functions
SELECT pg_temp.expect('route_of_run: a run follows its weekday''s route',
    route_of_run((SELECT run_id FROM train_run WHERE train_no = '16535' ORDER BY run_date LIMIT 1))
    = (SELECT route_id FROM route WHERE route_code = 'PUNE-UBL'));
SELECT pg_temp.expect('get_route_distance: SUR -> UBL on 16535 is 369 km',
    get_route_distance('16535', 'SUR', 'UBL') = 369);
SELECT pg_temp.expect('get_route_distance: 0 when the train does not serve the stations in that order',
    get_route_distance('16535', 'UBL', 'SUR') = 0 AND get_route_distance('16535', 'PUNE', 'NDLS') = 0);
SELECT pg_temp.expect('calculate_fare: PUNE -> UBL in SL = 631 km x 1.20 + 20',
    calculate_fare('16535', 'PUNE', 'UBL', 'SL') = 777.20);
SELECT pg_temp.expect('calculate_fare: 0 for an unknown class',
    calculate_fare('16535', 'PUNE', 'UBL', 'ZZ') = 0);
SELECT pg_temp.expect('stop_departure_at: Rajdhani leaves NDLS at 16:55 IST on the run date',
    (SELECT stop_departure_at(run_id, 1) FROM train_run WHERE train_no = '12952' AND run_date = CURRENT_DATE)
    = ((CURRENT_DATE + TIME '16:55') AT TIME ZONE 'Asia/Kolkata'));
SELECT pg_temp.expect('stop_arrival_at: Rajdhani reaches BCT at 08:25 IST the next day',
    (SELECT stop_arrival_at(run_id, 4) FROM train_run WHERE train_no = '12952' AND run_date = CURRENT_DATE)
    = ((CURRENT_DATE + 1 + TIME '08:25') AT TIME ZONE 'Asia/Kolkata'));
SELECT pg_temp.expect('stop_arrival_at: NULL at the first stop',
    (SELECT stop_arrival_at(run_id, 1) FROM train_run WHERE train_no = '12952' AND run_date = CURRENT_DATE) IS NULL);

-- ------------------------------------------------------------- views
SELECT pg_temp.expect('vw_train_schedules: 16535 runs Tue, Thu, Sun at 10:00',
    (SELECT string_agg(run_day, ',' ORDER BY run_day) FROM vw_train_schedules WHERE train_no = '16535')
        = 'Sunday,Thursday,Tuesday'
    AND NOT EXISTS (SELECT 1 FROM vw_train_schedules WHERE train_no = '16535' AND departure_time <> '10:00'));
SELECT pg_temp.expect('vw_train_stops: clock times from the route departure and offsets',
    EXISTS (SELECT 1 FROM vw_train_stops WHERE train_no = '16535' AND station_code = 'BJP'
            AND arrival_time = '16:45' AND departure_time = '16:50' AND day_offset = 0)
    AND EXISTS (SELECT 1 FROM vw_train_stops WHERE train_no = '12622' AND station_code = 'NGP'
            AND arrival_time = '00:20' AND day_offset = 1));

ROLLBACK;
