package com.railway.train.repository;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Timetable of a run from the C2 functions (stop_arrival_at /
 * stop_departure_at), and the booking a PNR refers to.
 */
@Repository
public class LiveStatusRepository {

    public record RunRow(int runId, String trainNo, String trainName, LocalDate runDate, String status,
                         int delayMinutes) {
    }

    public record StopRow(int seq, String stationCode, String stationName, java.math.BigDecimal distanceKm,
                          String platform, OffsetDateTime arrival, OffsetDateTime departure) {
    }

    public record BookingRef(int runId, int userId, int fromSeq, int toSeq) {
    }

    private final JdbcTemplate jdbc;

    public LiveStatusRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<RunRow> findRun(int runId) {
        return jdbc.query("""
                SELECT r.run_id, r.train_no, t.train_name, r.run_date, r.status, r.delay_minutes
                FROM train_run r JOIN train t ON t.train_no = r.train_no
                WHERE r.run_id = ?""",
                (rs, i) -> new RunRow(rs.getInt("run_id"), rs.getString("train_no"), rs.getString("train_name"),
                        rs.getObject("run_date", LocalDate.class), rs.getString("status"),
                        rs.getInt("delay_minutes")), runId).stream().findFirst();
    }

    public List<StopRow> stops(int runId) {
        return jdbc.query("""
                SELECT rs.stop_seq, rs.station_code, st.station_name, rs.distance_km, rs.default_platform,
                       stop_arrival_at(?, rs.stop_seq) AS arrival, stop_departure_at(?, rs.stop_seq) AS departure
                FROM route_station rs
                JOIN station st ON st.station_code = rs.station_code
                WHERE rs.route_id = route_of_run(?)
                ORDER BY rs.stop_seq""",
                (rs, i) -> new StopRow(rs.getInt("stop_seq"), rs.getString("station_code"),
                        rs.getString("station_name"), rs.getBigDecimal("distance_km"),
                        rs.getString("default_platform"), rs.getObject("arrival", OffsetDateTime.class),
                        rs.getObject("departure", OffsetDateTime.class)),
                runId, runId, runId);
    }

    /** The run and journey of a booking (Team 3's booking table). */
    public Optional<BookingRef> findBooking(String pnr) {
        return jdbc.query("SELECT run_id, user_id, from_seq, to_seq FROM booking WHERE pnr = ?",
                (rs, i) -> new BookingRef(rs.getInt("run_id"), rs.getInt("user_id"), rs.getInt("from_seq"),
                        rs.getInt("to_seq")), pnr).stream().findFirst();
    }
}
