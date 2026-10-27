-- =========================================================================
-- C2 Network — triggers
--
--   trg_validate_route_sequence  stops get farther and later along a route;
--                                day_offset follows from the times
--   trg_route_departure_change   keeps day_offset right when a route's
--                                departure time changes
-- =========================================================================

-- Day (counted from the run date) on which a stop is reached, given the
-- route's departure time and the stop's offset in minutes
CREATE FUNCTION stop_day_offset(p_departure TIME, p_offset_minutes INTEGER) RETURNS INTEGER
LANGUAGE sql IMMUTABLE AS $$
    SELECT ((extract(epoch FROM p_departure)::INTEGER / 60 + p_offset_minutes) / 1440)
$$;

-- Function to validate route stop distances and sequencing:
--   distance and times grow from the previous stop, a train leaves a stop
--   no earlier than it arrives, and day_offset (the day the stop is
--   reached) is worked out from the times rather than typed in.
CREATE FUNCTION validate_route_sequence()
RETURNS TRIGGER AS $$
DECLARE
    v_prev route_station%ROWTYPE;
BEGIN
    IF NEW.arrival_offset IS NOT NULL AND NEW.departure_offset < NEW.arrival_offset THEN
        RAISE EXCEPTION 'Invalid stop %: departs (% min) before it arrives (% min)',
            NEW.stop_seq, NEW.departure_offset, NEW.arrival_offset
            USING ERRCODE = 'check_violation', CONSTRAINT = 'trg_validate_route_sequence';
    END IF;

    -- If this is not the first stop, it must be farther and later than the previous one
    IF NEW.stop_seq > 1 THEN
        SELECT * INTO v_prev
        FROM route_station
        WHERE route_id = NEW.route_id AND stop_seq = NEW.stop_seq - 1;

        IF FOUND AND NEW.distance_km <= v_prev.distance_km THEN
            RAISE EXCEPTION 'Invalid route sequence: Distance for stop % (%) must be greater than previous stop distance (%)',
                NEW.stop_seq, NEW.distance_km, v_prev.distance_km
                USING ERRCODE = 'check_violation', CONSTRAINT = 'trg_validate_route_sequence';
        END IF;
        IF FOUND AND coalesce(NEW.arrival_offset, NEW.departure_offset) < v_prev.departure_offset THEN
            RAISE EXCEPTION 'Invalid route sequence: stop % is reached before stop % is left',
                NEW.stop_seq, v_prev.stop_seq
                USING ERRCODE = 'check_violation', CONSTRAINT = 'trg_validate_route_sequence';
        END IF;
    END IF;

    NEW.day_offset := stop_day_offset((SELECT departure_time FROM route WHERE route_id = NEW.route_id),
                                      coalesce(NEW.arrival_offset, NEW.departure_offset));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger execution on route_station inserts or updates
CREATE TRIGGER trg_validate_route_sequence
    BEFORE INSERT OR UPDATE ON route_station
    FOR EACH ROW
    EXECUTE FUNCTION validate_route_sequence();

-- A new departure time can move stops to another day
CREATE FUNCTION route_departure_changed()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE route_station
    SET day_offset = stop_day_offset(NEW.departure_time, coalesce(arrival_offset, departure_offset))
    WHERE route_id = NEW.route_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_route_departure_change
    AFTER UPDATE OF departure_time ON route
    FOR EACH ROW
    WHEN (NEW.departure_time IS DISTINCT FROM OLD.departure_time)
    EXECUTE FUNCTION route_departure_changed();
