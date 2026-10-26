-- =========================================================================
-- C2-Network Database Views (04_views.sql)
-- =========================================================================

-- 1. Schedule View: Combines train info, schedules, and active days for easy querying
CREATE OR REPLACE VIEW vw_train_schedules AS
SELECT 
    t.train_no,
    t.train_name,
    t.is_active,
    s.run_day
FROM train t
JOIN train_schedule s ON t.train_no = s.train_no;


-- 2. Route Stops View: Displays detailed route sequences with station names and distances
CREATE OR REPLACE VIEW vw_train_stops AS
SELECT 
    rs.train_no,
    t.train_name,
    rs.stop_seq,
    rs.station_code,
    st.station_name,
    rs.distance_km,
    rs.arrival_time,
    rs.departure_time
FROM route_station rs
JOIN train t ON rs.train_no = t.train_no
JOIN station st ON rs.station_code = st.station_code;