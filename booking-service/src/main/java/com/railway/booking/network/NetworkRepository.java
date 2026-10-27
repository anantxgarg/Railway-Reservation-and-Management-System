package com.railway.booking.network;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.railway.booking.network.NetworkModels.ClassAvailability;
import com.railway.booking.network.NetworkModels.Run;
import com.railway.booking.network.NetworkModels.SearchResult;
import com.railway.booking.network.NetworkModels.Stop;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Reads trains, routes and availability. The network tables are Team 2's
 * (database/c2-network); availability comes from the C3 availability()
 * function, so it matches what create_booking will do.
 */
@Repository
public class NetworkRepository {

    private static final String RUN_SQL = """
            SELECT run_id, train_no, train_name, run_date, run_status
            FROM v_run_route WHERE run_id = ?""";

    private static final String STOPS_SQL = """
            SELECT rs.stop_seq, rs.station_code, s.station_name, rr.run_date + rs.day_offset AS stop_date,
                   (rt.departure_time + make_interval(mins => rs.arrival_offset))::TIME AS arrival_time,
                   (rt.departure_time + make_interval(mins => rs.departure_offset))::TIME AS departure_time
            FROM v_run_route rr
            JOIN route rt ON rt.route_id = rr.route_id
            JOIN route_station rs ON rs.route_id = rr.route_id
            JOIN station s ON s.station_code = rs.station_code
            WHERE rr.run_id = ?
            ORDER BY rs.stop_seq""";

    // classes are listed dearest first (1A before SL)
    private static final String AVAILABILITY_SQL = """
            SELECT tc.class_code, tc.class_name,
                   (SELECT count(*) FROM seat s
                    JOIN train_coach c ON c.train_no = s.train_no AND c.coach_no = s.coach_no
                    WHERE s.train_no = r.train_no AND c.class_code = tc.class_code)::INTEGER AS total_seats,
                   a.available_seats, rac_capacity(r.run_id, tc.class_code) AS rac_capacity,
                   a.rac_available, a.waitlist_count,
                   calc_fare(r.run_id, tc.class_code, 'GN', ?, ?) AS fare
            FROM train_run r
            JOIN travel_class tc ON tc.class_code IN (SELECT class_code FROM train_coach WHERE train_no = r.train_no)
            CROSS JOIN LATERAL availability(r.run_id, tc.class_code, ?, ?) a
            WHERE r.run_id = ? AND (?::VARCHAR IS NULL OR tc.class_code = ?)
            ORDER BY tc.base_fare_per_km DESC""";

    // trains that stop at "from" and later at "to", leaving "from" on the given date
    private static final String SEARCH_SQL = """
            WITH legs AS (
                SELECT rr.run_id, rr.train_no, rr.train_name, rr.run_date,
                       f.stop_seq AS from_seq, f.station_code AS from_code, fst.station_name AS from_name,
                       rr.run_date + f.day_offset AS from_date,
                       (rt.departure_time + make_interval(mins => f.departure_offset))::TIME AS from_time,
                       t.stop_seq AS to_seq, t.station_code AS to_code, tst.station_name AS to_name,
                       rr.run_date + t.day_offset AS to_date,
                       (rt.departure_time + make_interval(mins => t.arrival_offset))::TIME AS to_time,
                       t.distance_km - f.distance_km AS distance_km
                FROM v_run_route rr
                JOIN route rt ON rt.route_id = rr.route_id
                JOIN route_station f ON f.route_id = rr.route_id AND f.station_code = ?
                JOIN route_station t ON t.route_id = rr.route_id AND t.station_code = ? AND t.stop_seq > f.stop_seq
                JOIN station fst ON fst.station_code = f.station_code
                JOIN station tst ON tst.station_code = t.station_code
                WHERE rr.run_date + f.day_offset = ?
                  AND rr.run_status IS DISTINCT FROM 'CANCELLED'
            )
            SELECT l.*, tc.class_code, tc.class_name,
                   (SELECT count(*) FROM seat s
                    JOIN train_coach c ON c.train_no = s.train_no AND c.coach_no = s.coach_no
                    WHERE s.train_no = l.train_no AND c.class_code = tc.class_code)::INTEGER AS total_seats,
                   a.available_seats, rac_capacity(l.run_id, tc.class_code) AS rac_capacity,
                   a.rac_available, a.waitlist_count,
                   calc_fare(l.run_id, tc.class_code, 'GN', l.from_seq, l.to_seq) AS fare
            FROM legs l
            JOIN travel_class tc ON tc.class_code IN (SELECT class_code FROM train_coach WHERE train_no = l.train_no)
            CROSS JOIN LATERAL availability(l.run_id, tc.class_code, l.from_seq, l.to_seq) a
            ORDER BY l.train_no, tc.base_fare_per_km DESC""";

    private final JdbcTemplate jdbc;

    public NetworkRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Run> findRun(int runId) {
        return jdbc.query(RUN_SQL, (rs, i) -> new Run(rs.getInt("run_id"), rs.getString("train_no"),
                rs.getString("train_name"), rs.getObject("run_date", LocalDate.class),
                rs.getString("run_status")), runId).stream().findFirst();
    }

    /** The stops of a run's route in order; empty if the run has no route. */
    public List<Stop> stopsOfRun(int runId) {
        return jdbc.query(STOPS_SQL, (rs, i) -> new Stop(rs.getInt("stop_seq"), rs.getString("station_code"),
                rs.getString("station_name"), rs.getObject("stop_date", LocalDate.class),
                rs.getObject("arrival_time", LocalTime.class), rs.getObject("departure_time", LocalTime.class)), runId);
    }

    /** Availability per class between two stops; classCode null means every class on the train. */
    public List<ClassAvailability> availability(int runId, String classCode, int fromSeq, int toSeq) {
        return jdbc.query(AVAILABILITY_SQL, (rs, i) -> classAvailability(rs),
                fromSeq, toSeq, fromSeq, toSeq, runId, classCode, classCode);
    }

    public List<SearchResult> search(String from, String to, LocalDate date) {
        Map<Integer, SearchResult> results = new LinkedHashMap<>();
        // one row per (run, class): group the classes under their run
        jdbc.query(SEARCH_SQL, rs -> {
            int runId = rs.getInt("run_id");
            SearchResult result = results.get(runId);
            if (result == null) {
                result = new SearchResult(runId, rs.getString("train_no"), rs.getString("train_name"),
                        rs.getObject("run_date", LocalDate.class),
                        new Stop(rs.getInt("from_seq"), rs.getString("from_code"), rs.getString("from_name"),
                                rs.getObject("from_date", LocalDate.class), null,
                                rs.getObject("from_time", LocalTime.class)),
                        new Stop(rs.getInt("to_seq"), rs.getString("to_code"), rs.getString("to_name"),
                                rs.getObject("to_date", LocalDate.class),
                                rs.getObject("to_time", LocalTime.class), null),
                        rs.getBigDecimal("distance_km"), new ArrayList<>());
                results.put(runId, result);
            }
            result.classes().add(classAvailability(rs));
        }, from, to, date);
        return List.copyOf(results.values());
    }

    private static ClassAvailability classAvailability(ResultSet rs) throws SQLException {
        return new ClassAvailability(rs.getString("class_code"), rs.getString("class_name"),
                rs.getInt("total_seats"), rs.getInt("available_seats"), rs.getInt("rac_capacity"),
                rs.getInt("rac_available"), rs.getInt("waitlist_count"), rs.getBigDecimal("fare"));
    }
}
