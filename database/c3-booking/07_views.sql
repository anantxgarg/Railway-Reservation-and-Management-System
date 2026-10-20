-- =====================================================================
-- C3 Booking — 07: views
--
--   v_run_route         each run with its derived route
--   v_pnr_status        one row per passenger: the "PNR status" screen
--   v_user_bookings     one row per booking: "My bookings" (also for Team 5)
--   v_run_availability  per run and class, end-to-end availability
-- =====================================================================

CREATE VIEW v_run_route AS
SELECT r.run_id, r.train_no, t.train_name, r.run_date, r.status AS run_status, s.route_id
FROM train_run r
JOIN train t ON t.train_no = r.train_no
LEFT JOIN train_schedule s ON s.train_no = r.train_no AND s.run_day = to_char(r.run_date, 'FMDay');

COMMENT ON VIEW v_run_route IS 'Each train run with its route (derived from train_schedule by weekday)';

-- ---------------------------------------------------------------------
-- v_pnr_status
--   queue_no is the number given when the passenger joined the queue;
--   current_position is where they are now. status_label reads like a
--   ticket: CNF/B1/23/LB, RAC 3, WL 12, CAN.
-- ---------------------------------------------------------------------
CREATE VIEW v_pnr_status AS
SELECT b.pnr,
       b.user_id,
       b.status                          AS booking_status,
       b.hold_expires_at,
       b.created_at,
       rr.train_no,
       rr.train_name,
       b.run_id,
       rr.run_date,
       rr.run_date + fs.day_offset       AS journey_date,
       b.class_code,
       tc.class_name,
       b.quota_code,
       b.from_seq,
       fs.station_code                   AS from_station,
       fst.station_name                  AS from_station_name,
       b.to_seq,
       ts.station_code                   AS to_station,
       tst.station_name                  AS to_station_name,
       b.total_fare,
       p.passenger_id,
       row_number() OVER (PARTITION BY b.pnr ORDER BY p.passenger_id) AS passenger_no,
       p.name,
       p.age,
       p.gender,
       p.concession_id,
       p.status                          AS passenger_status,
       p.queue_no,
       pos.current_position,
       s.coach_no,
       s.berth_no,
       s.berth_type,
       p.passenger_fare,
       p.cancelled_at,
       CASE p.status
           WHEN 'CONFIRMED' THEN 'CNF/' || s.coach_no || '/' || s.berth_no || coalesce('/' || s.berth_type, '')
           WHEN 'RAC'       THEN 'RAC ' || pos.current_position
           WHEN 'WAITLIST'  THEN 'WL ' || pos.current_position
           ELSE 'CAN'
       END                               AS status_label
FROM booking b
JOIN v_run_route rr      ON rr.run_id = b.run_id
JOIN travel_class tc     ON tc.class_code = b.class_code
JOIN route_station fs    ON fs.route_id = rr.route_id AND fs.stop_seq = b.from_seq
JOIN station fst         ON fst.station_code = fs.station_code
JOIN route_station ts    ON ts.route_id = rr.route_id AND ts.stop_seq = b.to_seq
JOIN station tst         ON tst.station_code = ts.station_code
JOIN passenger p         ON p.pnr = b.pnr
LEFT JOIN seat_allocation sa ON sa.passenger_id = p.passenger_id
LEFT JOIN seat s         ON s.seat_id = sa.seat_id
LEFT JOIN LATERAL (
    SELECT count(*)::INTEGER AS current_position
    FROM passenger q JOIN booking qb ON qb.pnr = q.pnr
    WHERE p.status IN ('RAC', 'WAITLIST')
      AND qb.run_id = b.run_id AND qb.class_code = b.class_code AND qb.quota_code = b.quota_code
      AND qb.status IN ('HELD', 'CONFIRMED')
      AND q.status = p.status AND q.queue_no <= p.queue_no
) pos ON TRUE;

COMMENT ON VIEW v_pnr_status IS 'PNR status: one row per passenger with seat or current queue position';

-- ---------------------------------------------------------------------
-- v_user_bookings
-- ---------------------------------------------------------------------
CREATE VIEW v_user_bookings AS
SELECT b.pnr,
       b.user_id,
       b.status,
       rr.train_no,
       rr.train_name,
       rr.run_date + fs.day_offset AS journey_date,
       fs.station_code             AS from_station,
       ts.station_code             AS to_station,
       b.class_code,
       b.quota_code,
       (SELECT count(*) FROM passenger p WHERE p.pnr = b.pnr)::INTEGER                             AS passengers,
       (SELECT count(*) FROM passenger p WHERE p.pnr = b.pnr AND p.status <> 'CANCELLED')::INTEGER AS active_passengers,
       b.total_fare,
       b.hold_expires_at,
       b.created_at
FROM booking b
JOIN v_run_route rr   ON rr.run_id = b.run_id
JOIN route_station fs ON fs.route_id = rr.route_id AND fs.stop_seq = b.from_seq
JOIN route_station ts ON ts.route_id = rr.route_id AND ts.stop_seq = b.to_seq;

COMMENT ON VIEW v_user_bookings IS 'One row per booking, for "My bookings" and reporting';

-- ---------------------------------------------------------------------
-- v_run_availability: availability for the full route of each run.
-- For a shorter journey call availability(run_id, class, from, to).
-- ---------------------------------------------------------------------
CREATE VIEW v_run_availability AS
SELECT rr.run_id,
       rr.train_no,
       rr.train_name,
       rr.run_date,
       tc.class_code,
       (SELECT count(*) FROM seat s JOIN train_coach c ON c.train_no = s.train_no AND c.coach_no = s.coach_no
        WHERE s.train_no = rr.train_no AND c.class_code = tc.class_code)::INTEGER AS total_seats,
       a.available_seats,
       rac_capacity(rr.run_id, tc.class_code) AS rac_capacity,
       a.rac_available,
       a.waitlist_count
FROM v_run_route rr
JOIN (SELECT DISTINCT train_no, class_code FROM train_coach) tc ON tc.train_no = rr.train_no
CROSS JOIN LATERAL (SELECT max(stop_seq) AS last_seq FROM route_station WHERE route_id = rr.route_id) l
CROSS JOIN LATERAL availability(rr.run_id, tc.class_code, 1, l.last_seq) a;

COMMENT ON VIEW v_run_availability IS 'Seats, RAC and waitlist per run and class for the whole route';
