package com.railway.train.repository;

import java.sql.Time;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import com.railway.train.model.RouteStation;

@Repository
public class RouteStationRepository {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final RowMapper<RouteStation> rowMapper = (rs, rowNum) -> {
        RouteStation routeStation = new RouteStation();
        routeStation.setRouteId(rs.getString("route_id"));
        routeStation.setStopSeq(rs.getInt("stop_seq"));
        routeStation.setStationCode(rs.getString("station_code"));
        routeStation.setDistanceKm(rs.getBigDecimal("distance_km"));
        Time arrival = rs.getTime("arrival_time");
        Time departure = rs.getTime("departure_time");
        routeStation.setArrivalTime(arrival != null ? arrival.toLocalTime() : null);
        routeStation.setDepartureTime(departure != null ? departure.toLocalTime() : null);
        return routeStation;
    };

    public List<RouteStation> findAll() {
        return jdbcTemplate.query(
                "SELECT route_id, stop_seq, station_code, distance_km, arrival_time, departure_time FROM route_station ORDER BY route_id, stop_seq",
                rowMapper
        );
    }

    public List<RouteStation> findByRouteId(String routeId) {
        return jdbcTemplate.query(
                "SELECT route_id, stop_seq, station_code, distance_km, arrival_time, departure_time FROM route_station WHERE route_id = ? ORDER BY stop_seq",
                rowMapper,
                routeId
        );
    }

    public void save(RouteStation rs) {
        String sql = "INSERT INTO route_station (route_id, stop_seq, station_code, distance_km, arrival_time, departure_time) " +
                     "VALUES (?, ?, ?, ?, ?, ?) " +
                     "ON CONFLICT (route_id, stop_seq) DO UPDATE SET " +
                     "station_code = EXCLUDED.station_code, distance_km = EXCLUDED.distance_km, " +
                     "arrival_time = EXCLUDED.arrival_time, departure_time = EXCLUDED.departure_time";
        jdbcTemplate.update(
                sql,
                rs.getRouteId(),
                rs.getStopSeq(),
                rs.getStationCode(),
                rs.getDistanceKm(),
                rs.getArrivalTime() != null ? Time.valueOf(rs.getArrivalTime()) : null,
                rs.getDepartureTime() != null ? Time.valueOf(rs.getDepartureTime()) : null
        );
    }

    public boolean deleteByRouteIdAndStopSeq(String routeId, int stopSeq) {
        return jdbcTemplate.update("DELETE FROM route_station WHERE route_id = ? AND stop_seq = ?", routeId, stopSeq) > 0;
    }
}
