-- =====================================================================
-- C3 Booking — 04: helper functions (UDFs)
--
-- Read-only building blocks used by the triggers (05), the booking
-- procedures (06) and the views (07): PNR generation, route lookup,
-- fares, seat and RAC availability.
-- =====================================================================

-- ---------------------------------------------------------------------
-- PNR: 9 digits from a sequence + 1 Luhn check digit = 10 digits
-- ---------------------------------------------------------------------
CREATE SEQUENCE pnr_seq START 100000001 MINVALUE 100000000 MAXVALUE 999999999 NO CYCLE;

-- Luhn check digit for a string of digits (doubles every second digit
-- counting from the right, so a mistyped digit changes the result)
CREATE FUNCTION luhn_check_digit(digits TEXT) RETURNS INTEGER
LANGUAGE sql IMMUTABLE STRICT AS $$
    SELECT ((10 - sum(CASE WHEN (n - i) % 2 = 0
                           THEN CASE WHEN 2 * d > 9 THEN 2 * d - 9 ELSE 2 * d END
                           ELSE d END) % 10) % 10)::INTEGER
    FROM (SELECT length(digits) AS n, i, substr(digits, i, 1)::INTEGER AS d
          FROM generate_series(1, length(digits)) AS i) x
$$;

CREATE FUNCTION generate_pnr() RETURNS VARCHAR(10)
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
    body TEXT := nextval('pnr_seq')::TEXT;
BEGIN
    RETURN body || luhn_check_digit(body);
END $$;

CREATE FUNCTION is_valid_pnr(p_pnr TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
    SELECT coalesce(p_pnr ~ '^[0-9]{10}$'
                    AND right(p_pnr, 1)::INTEGER = luhn_check_digit(left(p_pnr, 9)), FALSE)
$$;

COMMENT ON FUNCTION generate_pnr() IS 'Next PNR: 9-digit sequence number + Luhn check digit';
COMMENT ON FUNCTION is_valid_pnr(TEXT) IS 'True if the text is 10 digits with a correct check digit';

-- ---------------------------------------------------------------------
-- Route lookups (route_of_run is C2's, database/c2-network/functions.sql)
-- ---------------------------------------------------------------------
-- Calendar date on which the run reaches a stop (run_date + day_offset)
CREATE FUNCTION journey_date(p_run_id INTEGER, p_stop_seq INTEGER) RETURNS DATE
LANGUAGE sql STABLE AS $$
    SELECT r.run_date + rs.day_offset
    FROM train_run r
    JOIN route_station rs ON rs.route_id = route_of_run(r.run_id) AND rs.stop_seq = p_stop_seq
    WHERE r.run_id = p_run_id
$$;

-- Distance in km between two stops of a run's route (NULL if a stop is invalid)
CREATE FUNCTION segment_distance(p_run_id INTEGER, p_from_seq INTEGER, p_to_seq INTEGER) RETURNS NUMERIC
LANGUAGE sql STABLE AS $$
    SELECT t.distance_km - f.distance_km
    FROM route_station f
    JOIN route_station t ON t.route_id = f.route_id AND t.stop_seq = p_to_seq
    WHERE f.route_id = route_of_run(p_run_id) AND f.stop_seq = p_from_seq
$$;

-- ---------------------------------------------------------------------
-- Fare for one passenger
--   distance x class rate x quota multiplier, minus concession, plus
--   reservation charge. Placeholder: SCHEMA.MD gives fare UDFs to Team 4.
-- ---------------------------------------------------------------------
CREATE FUNCTION calc_fare(p_run_id INTEGER, p_class_code VARCHAR, p_quota_code VARCHAR,
                          p_from_seq INTEGER, p_to_seq INTEGER,
                          p_concession_id INTEGER DEFAULT NULL) RETURNS NUMERIC
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_km     NUMERIC := segment_distance(p_run_id, p_from_seq, p_to_seq);
    v_class  travel_class%ROWTYPE;
    v_mult   NUMERIC;
    v_rule   concession_rule%ROWTYPE;
    v_base   NUMERIC;
BEGIN
    IF v_km IS NULL OR v_km <= 0 THEN
        RAISE EXCEPTION 'invalid journey: stops % to % are not on this run''s route', p_from_seq, p_to_seq
            USING ERRCODE = 'invalid_parameter_value';
    END IF;
    SELECT * INTO v_class FROM travel_class WHERE class_code = p_class_code;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'unknown travel class %', p_class_code USING ERRCODE = 'invalid_parameter_value';
    END IF;
    SELECT fare_multiplier INTO v_mult FROM quota WHERE quota_code = p_quota_code;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'unknown quota %', p_quota_code USING ERRCODE = 'invalid_parameter_value';
    END IF;

    v_base := v_km * v_class.base_fare_per_km * v_mult;

    IF p_concession_id IS NOT NULL THEN
        SELECT * INTO v_rule FROM concession_rule WHERE concession_id = p_concession_id AND is_active;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'unknown or inactive concession %', p_concession_id
                USING ERRCODE = 'invalid_parameter_value';
        END IF;
        v_base := CASE v_rule.discount_type
                      WHEN 'PERCENTAGE' THEN v_base * (1 - least(v_rule.discount_value, 100) / 100)
                      ELSE greatest(v_base - v_rule.discount_value, 0)
                  END;
    END IF;

    RETURN round(v_base + v_class.reservation_charge, 2);
END $$;

COMMENT ON FUNCTION calc_fare(INTEGER, VARCHAR, VARCHAR, INTEGER, INTEGER, INTEGER)
    IS 'Fare for one passenger (placeholder until Team 4 provides the fare UDF)';

-- ---------------------------------------------------------------------
-- Seats and RAC
-- ---------------------------------------------------------------------

-- Seats of the run's train in the class that no allocation uses on any
-- part of [from_seq, to_seq). Segments touching at a stop do not overlap.
CREATE FUNCTION free_seats(p_run_id INTEGER, p_class_code VARCHAR, p_from_seq INTEGER, p_to_seq INTEGER)
RETURNS TABLE (seat_id INTEGER, coach_no VARCHAR, berth_no VARCHAR, berth_type VARCHAR)
LANGUAGE sql STABLE AS $$
    SELECT s.seat_id, s.coach_no, s.berth_no, s.berth_type
    FROM train_run r
    JOIN train_coach tc ON tc.train_no = r.train_no AND tc.class_code = p_class_code
    JOIN seat s ON s.train_no = tc.train_no AND s.coach_no = tc.coach_no
    WHERE r.run_id = p_run_id
      AND NOT EXISTS (
          SELECT 1 FROM seat_allocation sa
          WHERE sa.seat_id = s.seat_id AND sa.run_id = p_run_id
            AND int4range(sa.from_seq, sa.to_seq) && int4range(p_from_seq, p_to_seq))
    ORDER BY s.coach_no, length(s.berth_no), s.berth_no
$$;

-- RAC places per run and class: 2A 4 per coach, 3A/SL 8 per coach
-- (two passengers per side-lower berth), none for 1A and sitting classes
CREATE FUNCTION rac_capacity(p_run_id INTEGER, p_class_code VARCHAR) RETURNS INTEGER
LANGUAGE sql STABLE AS $$
    SELECT (count(*) * CASE p_class_code WHEN '2A' THEN 4 WHEN '3A' THEN 8 WHEN 'SL' THEN 8 ELSE 0 END)::INTEGER
    FROM train_run r
    JOIN train_coach tc ON tc.train_no = r.train_no AND tc.class_code = p_class_code
    WHERE r.run_id = p_run_id
$$;

-- Passengers of live bookings holding the given status (RAC/WAITLIST) on
-- the run and class whose journey overlaps [from_seq, to_seq)
CREATE FUNCTION queued_count(p_run_id INTEGER, p_class_code VARCHAR, p_status passenger_status_enum,
                             p_from_seq INTEGER DEFAULT 1, p_to_seq INTEGER DEFAULT 2147483647)
RETURNS INTEGER
LANGUAGE sql STABLE AS $$
    SELECT count(*)::INTEGER
    FROM passenger p
    JOIN booking b ON b.pnr = p.pnr
    WHERE b.run_id = p_run_id AND b.class_code = p_class_code
      AND b.status IN ('HELD', 'CONFIRMED')
      AND p.status = p_status
      AND int4range(b.from_seq, b.to_seq) && int4range(p_from_seq, p_to_seq)
$$;

-- Next queue number in the (run, class, quota) queue for RAC or WAITLIST
CREATE FUNCTION next_queue_no(p_run_id INTEGER, p_class_code VARCHAR, p_quota_code VARCHAR,
                              p_status passenger_status_enum) RETURNS INTEGER
LANGUAGE sql STABLE AS $$
    SELECT coalesce(max(p.queue_no), 0) + 1
    FROM passenger p
    JOIN booking b ON b.pnr = p.pnr
    WHERE b.run_id = p_run_id AND b.class_code = p_class_code AND b.quota_code = p_quota_code
      AND p.status = p_status
$$;

-- What a new booking for this journey would get right now
CREATE FUNCTION availability(p_run_id INTEGER, p_class_code VARCHAR, p_from_seq INTEGER, p_to_seq INTEGER)
RETURNS TABLE (available_seats INTEGER, rac_available INTEGER, waitlist_count INTEGER)
LANGUAGE sql STABLE AS $$
    SELECT (SELECT count(*)::INTEGER FROM free_seats(p_run_id, p_class_code, p_from_seq, p_to_seq)),
           greatest(rac_capacity(p_run_id, p_class_code)
                    - queued_count(p_run_id, p_class_code, 'RAC', p_from_seq, p_to_seq), 0),
           queued_count(p_run_id, p_class_code, 'WAITLIST', p_from_seq, p_to_seq)
$$;

COMMENT ON FUNCTION free_seats(INTEGER, VARCHAR, INTEGER, INTEGER) IS 'Seats free for the whole journey segment';
COMMENT ON FUNCTION rac_capacity(INTEGER, VARCHAR) IS 'RAC places for a run and class';
COMMENT ON FUNCTION availability(INTEGER, VARCHAR, INTEGER, INTEGER) IS 'Free seats, free RAC places and waitlist length for a journey';
