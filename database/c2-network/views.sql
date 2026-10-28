-- =========================================================================
-- C2 Network — views
--
--   vw_train_schedules  each train's operating weekdays, route and departure
--   vw_train_stops      each train's stops with clock times (IST)
-- =========================================================================

-- 1. Schedule View: Combines train info, schedules, and active days for easy querying
CREATE VIEW vw_train_schedules AS
SELECT
    t.train_no,
    t.train_name,
    t.is_active,
    s.run_day,
    s.route_id,
    r.route_code,
    r.departure_time
FROM train t
JOIN train_schedule s ON t.train_no = s.train_no
JOIN route r ON r.route_id = s.route_id;

COMMENT ON VIEW vw_train_schedules IS 'Weekdays each train runs, with the route and departure time of that day';

-- 2. Route Stops View: Displays detailed route sequences with station names, distances
-- and timetable. arrival_time/departure_time are clock times; day_offset says on
-- which day after departure from the first stop the stop is reached.
CREATE VIEW vw_train_stops AS
SELECT
    tr.train_no,
    t.train_name,
    rs.route_id,
    rs.stop_seq,
    rs.station_code,
    st.station_name,
    rs.distance_km,
    (r.departure_time + make_interval(mins => rs.arrival_offset))::TIME   AS arrival_time,
    (r.departure_time + make_interval(mins => rs.departure_offset))::TIME AS departure_time,
    rs.day_offset
FROM (SELECT DISTINCT train_no, route_id FROM train_schedule) tr
JOIN train t ON tr.train_no = t.train_no
JOIN route r ON r.route_id = tr.route_id
JOIN route_station rs ON rs.route_id = tr.route_id
JOIN station st ON rs.station_code = st.station_code;

COMMENT ON VIEW vw_train_stops IS 'Stops of each train''s route(s) with clock times; arrival is NULL at the first stop';
