-- =========================================================================
-- C2-Network UDFs (User-Defined Functions)
-- =========================================================================

-- Function to calculate travel distance between two stops on a train's route
CREATE OR REPLACE FUNCTION get_route_distance(p_train_no INTEGER, p_from_station VARCHAR, p_to_station VARCHAR)
RETURNS NUMERIC AS $$
DECLARE
    v_dist_from NUMERIC;
    v_dist_to NUMERIC;
BEGIN
    SELECT distance_km INTO v_dist_from 
    FROM route_station 
    WHERE train_no = p_train_no AND station_code = p_from_station;

    SELECT distance_km INTO v_dist_to 
    FROM route_station 
    WHERE train_no = p_train_no AND station_code = p_to_station;

    IF v_dist_from IS NULL OR v_dist_to IS NULL OR v_dist_to < v_dist_from THEN
        RETURN 0.00;
    END IF;

    RETURN v_dist_to - v_dist_from;
END;
$$ LANGUAGE plpgsql;


-- Function to calculate base ticket fare between two stations for a given class
CREATE OR REPLACE FUNCTION calculate_fare(p_train_no INTEGER, p_from_station VARCHAR, p_to_station VARCHAR, p_class_code VARCHAR)
RETURNS NUMERIC AS $$
DECLARE
    v_distance NUMERIC;
    v_base_rate NUMERIC;
    v_reservation_charge NUMERIC;
    v_total_fare NUMERIC;
BEGIN
    -- Get distance using the helper function
    v_distance := get_route_distance(p_train_no, p_from_station, p_to_station);
    
    IF v_distance <= 0 THEN
        RETURN 0.00;
    END IF;

    -- Get rate and reservation charge for the travel class
    SELECT base_fare_per_km, reservation_charge 
    INTO v_base_rate, v_reservation_charge
    FROM travel_class 
    WHERE class_code = p_class_code;

    IF v_base_rate IS NULL THEN
        RETURN 0.00;
    END IF;

    -- Calculate fare: (Distance * Rate per KM) + Reservation Charge
    v_total_fare := (v_distance * v_base_rate) + v_reservation_charge;

    RETURN ROUND(v_total_fare, 2);
END;
$$ LANGUAGE plpgsql;