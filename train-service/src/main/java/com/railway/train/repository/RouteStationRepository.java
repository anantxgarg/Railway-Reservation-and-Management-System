package com.railway.train.repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Time;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.railway.train.model.RouteStation;

@Repository
public class RouteStationRepository {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    // clock times from the route's departure time and the stop's offsets
    private static final String STOPS = """
            SELECT NULL AS train_no, rs.route_id, rs.stop_seq, rs.station_code, st.station_name, rs.distance_km,
                   rs.arrival_offset, rs.departure_offset, rs.day_offset, rs.default_platform,
                   (r.departure_time + make_interval(mins => rs.arrival_offset))::TIME AS arrival_time,
                   (r.departure_time + make_interval(mins => rs.departure_offset))::TIME AS departure_time
            FROM route_station rs
            JOIN route r ON r.route_id = rs.route_id
            JOIN station st ON st.station_code = rs.station_code""";

    private static RouteStation map(ResultSet rs, int rowNum) throws SQLException {
        RouteStation routeStation = new RouteStation();
        routeStation.setTrainNo(rs.getString("train_no"));
        routeStation.setRouteId(rs.getInt("route_id"));
        routeStation.setStopSeq(rs.getInt("stop_seq"));
        routeStation.setStationCode(rs.getString("station_code"));
        routeStation.setStationName(rs.getString("station_name"));
        routeStation.setDistanceKm(rs.getBigDecimal("distance_km"));
        routeStation.setArrivalOffset(rs.getObject("arrival_offset", Integer.class));
        routeStation.setDepartureOffset(rs.getInt("departure_offset"));
        routeStation.setDayOffset(rs.getInt("day_offset"));
        routeStation.setDefaultPlatform(rs.getString("default_platform"));
        Time arrival = rs.getTime("arrival_time");
        Time departure = rs.getTime("departure_time");
        routeStation.setArrivalTime(arrival != null ? arrival.toLocalTime() : null);
        routeStation.setDepartureTime(departure != null ? departure.toLocalTime() : null);
        return routeStation;
    }

    public List<RouteStation> findAll() {
        return jdbcTemplate.query(STOPS + " ORDER BY rs.route_id, rs.stop_seq", RouteStationRepository::map);
    }

    public List<RouteStation> findByRouteId(int routeId) {
        return jdbcTemplate.query(STOPS + " WHERE rs.route_id = ? ORDER BY rs.stop_seq",
                RouteStationRepository::map, routeId);
    }

    /** Stops of every route the train follows (vw_train_stops). */
    public List<RouteStation> findByTrainNo(String trainNo) {
        return jdbcTemplate.query("""
                SELECT v.train_no, v.route_id, v.stop_seq, v.station_code, v.station_name, v.distance_km,
                       rs.arrival_offset, rs.departure_offset, v.day_offset, rs.default_platform,
                       v.arrival_time, v.departure_time
                FROM vw_train_stops v
                JOIN route_station rs ON rs.route_id = v.route_id AND rs.stop_seq = v.stop_seq
                WHERE v.train_no = ?
                ORDER BY v.route_id, v.stop_seq""", RouteStationRepository::map, trainNo);
    }

    // day_offset is set by the database (trg_validate_route_sequence)
    public void save(RouteStation rs) {
        String sql = "INSERT INTO route_station (route_id, stop_seq, station_code, distance_km, arrival_offset, departure_offset, default_platform) " +
                     "VALUES (?, ?, ?, ?, ?, ?, ?) " +
                     "ON CONFLICT (route_id, stop_seq) DO UPDATE SET " +
                     "station_code = EXCLUDED.station_code, distance_km = EXCLUDED.distance_km, " +
                     "arrival_offset = EXCLUDED.arrival_offset, departure_offset = EXCLUDED.departure_offset, " +
                     "default_platform = EXCLUDED.default_platform";
        jdbcTemplate.update(
                sql,
                rs.getRouteId(),
                rs.getStopSeq(),
                rs.getStationCode(),
                rs.getDistanceKm(),
                rs.getArrivalOffset(),
                rs.getDepartureOffset(),
                rs.getDefaultPlatform()
        );
    }

    public boolean deleteByRouteIdAndStopSeq(int routeId, int stopSeq) {
        return jdbcTemplate.update("DELETE FROM route_station WHERE route_id = ? AND stop_seq = ?", routeId, stopSeq) > 0;
    }
}
