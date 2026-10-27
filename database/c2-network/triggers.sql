-- =========================================================================
-- C2-Network Database Triggers & Audit Functions
-- =========================================================================

-- Function to validate route stop distances and sequencing
CREATE OR REPLACE FUNCTION validate_route_sequence()
RETURNS TRIGGER AS $$
DECLARE
    v_prev_distance NUMERIC;
BEGIN
    -- If this is not the first stop (stop_seq > 1), check that distance is greater than the previous stop
    IF NEW.stop_seq > 1 THEN
        SELECT distance_km INTO v_prev_distance
        FROM route_station
        WHERE train_no = NEW.train_no AND stop_seq = NEW.stop_seq - 1;

        IF FOUND AND NEW.distance_km <= v_prev_distance THEN
            RAISE EXCEPTION 'Invalid route sequence: Distance for stop % (%) must be greater than previous stop distance (%)',
                NEW.stop_seq, NEW.distance_km, v_prev_distance;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger execution on route_station inserts or updates
DROP TRIGGER IF EXISTS trg_validate_route_sequence ON route_station;
CREATE TRIGGER trg_validate_route_sequence
    BEFORE INSERT OR UPDATE ON route_station
    FOR EACH ROW
    EXECUTE FUNCTION validate_route_sequence();