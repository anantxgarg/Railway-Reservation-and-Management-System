-- =========================================================================
-- C2 Network — functions (UDFs)
--
--   route_of_run         the route a dated run follows (moved here from C3)
--   stop_arrival_at /    when a run reaches / leaves a stop, from the route's
--   stop_departure_at    departure time and the stop offsets (IST)
--   get_route_distance   km between two stations on a train's route
--   calculate_fare       base fare between two stations for a class
-- =========================================================================

-- Route of a run: train_schedule row for (train_no, weekday of run_date)
CREATE FUNCTION route_of_run(p_run_id INTEGER) RETURNS INTEGER
LANGUAGE sql STABLE AS $$
    SELECT s.route_id
    FROM train_run r
    JOIN train_schedule s ON s.train_no = r.train_no
                         AND s.run_day = to_char(r.run_date, 'FMDay')
    WHERE r.run_id = p_run_id
$$;

COMMENT ON FUNCTION route_of_run(INTEGER) IS 'Route a dated run follows (derived from train_schedule by weekday)';

-- Moment a run arrives at / departs from a stop, by the timetable (no delay).
-- The route's departure_time is Indian local time; offsets are minutes from it.
-- Arrival is NULL at the first stop.
CREATE FUNCTION stop_arrival_at(p_run_id INTEGER, p_stop_seq INTEGER) RETURNS TIMESTAMPTZ
LANGUAGE sql STABLE AS $$
    SELECT ((r.run_date + rt.departure_time) AT TIME ZONE 'Asia/Kolkata')
           + make_interval(mins => rs.arrival_offset)
    FROM train_run r
    JOIN route rt ON rt.route_id = route_of_run(r.run_id)
    JOIN route_station rs ON rs.route_id = rt.route_id AND rs.stop_seq = p_stop_seq
    WHERE r.run_id = p_run_id
$$;

CREATE FUNCTION stop_departure_at(p_run_id INTEGER, p_stop_seq INTEGER) RETURNS TIMESTAMPTZ
LANGUAGE sql STABLE AS $$
    SELECT ((r.run_date + rt.departure_time) AT TIME ZONE 'Asia/Kolkata')
           + make_interval(mins => rs.departure_offset)
    FROM train_run r
    JOIN route rt ON rt.route_id = route_of_run(r.run_id)
    JOIN route_station rs ON rs.route_id = rt.route_id AND rs.stop_seq = p_stop_seq
    WHERE r.run_id = p_run_id
$$;

COMMENT ON FUNCTION stop_arrival_at(INTEGER, INTEGER) IS 'Timetabled arrival of a run at a stop (NULL at the first stop)';
COMMENT ON FUNCTION stop_departure_at(INTEGER, INTEGER) IS 'Timetabled departure of a run from a stop';

-- Function to calculate travel distance between two stations on a train's route.
-- A train can follow different routes on different weekdays; the first of its
-- routes that serves both stations in this order is used. 0 if none does.
CREATE FUNCTION get_route_distance(p_train_no VARCHAR, p_from_station VARCHAR, p_to_station VARCHAR)
RETURNS NUMERIC AS $$
DECLARE
    v_distance NUMERIC;
BEGIN
    SELECT t.distance_km - f.distance_km INTO v_distance
    FROM (SELECT DISTINCT route_id FROM train_schedule WHERE train_no = p_train_no) s
    JOIN route_station f ON f.route_id = s.route_id AND f.station_code = p_from_station
    JOIN route_station t ON t.route_id = s.route_id AND t.station_code = p_to_station
                        AND t.stop_seq > f.stop_seq
    ORDER BY s.route_id
    LIMIT 1;

    RETURN coalesce(v_distance, 0.00);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_route_distance(VARCHAR, VARCHAR, VARCHAR) IS 'Km between two stations on a train''s route (0 if not served in that order)';

-- Function to calculate base ticket fare between two stations for a given class:
-- distance x rate per km + reservation charge. 0 if the journey or class is unknown.
-- Booking (C3) charges with calc_fare, which also applies quota and concession.
CREATE FUNCTION calculate_fare(p_train_no VARCHAR, p_from_station VARCHAR, p_to_station VARCHAR, p_class_code VARCHAR)
RETURNS NUMERIC AS $$
DECLARE
    v_distance NUMERIC;
    v_base_rate NUMERIC;
    v_reservation_charge NUMERIC;
BEGIN
    v_distance := get_route_distance(p_train_no, p_from_station, p_to_station);
    IF v_distance <= 0 THEN
        RETURN 0.00;
    END IF;

    SELECT base_fare_per_km, reservation_charge
    INTO v_base_rate, v_reservation_charge
    FROM travel_class
    WHERE class_code = p_class_code;

    IF v_base_rate IS NULL THEN
        RETURN 0.00;
    END IF;

    RETURN ROUND(v_distance * v_base_rate + v_reservation_charge, 2);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_fare(VARCHAR, VARCHAR, VARCHAR, VARCHAR) IS 'Base fare between two stations: distance x class rate + reservation charge';
