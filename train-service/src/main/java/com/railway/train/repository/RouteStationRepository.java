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
        routeStation.setTrainNo(rs.getInt("train_no"));
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
                "SELECT train_no, stop_seq, station_code, distance_km, arrival_time, departure_time FROM route_station ORDER BY train_no, stop_seq",
                rowMapper
        );
    }

    public List<RouteStation> findByTrainNo(Integer trainNo) {
        return jdbcTemplate.query(
                "SELECT train_no, stop_seq, station_code, distance_km, arrival_time, departure_time FROM route_station WHERE train_no = ? ORDER BY stop_seq",
                rowMapper,
                trainNo
        );
    }

    public void save(RouteStation rs) {
        String sql = "INSERT INTO route_station (train_no, stop_seq, station_code, distance_km, arrival_time, departure_time) " +
                     "VALUES (?, ?, ?, ?, ?, ?) " +
                     "ON CONFLICT (train_no, stop_seq) DO UPDATE SET " +
                     "station_code = EXCLUDED.station_code, distance_km = EXCLUDED.distance_km, " +
                     "arrival_time = EXCLUDED.arrival_time, departure_time = EXCLUDED.departure_time";
        jdbcTemplate.update(
                sql,
                rs.getTrainNo(),
                rs.getStopSeq(),
                rs.getStationCode(),
                rs.getDistanceKm(),
                rs.getArrivalTime() != null ? Time.valueOf(rs.getArrivalTime()) : null,
                rs.getDepartureTime() != null ? Time.valueOf(rs.getDepartureTime()) : null
        );
    }

    public boolean deleteByTrainNoAndStopSeq(Integer trainNo, int stopSeq) {
        return jdbcTemplate.update("DELETE FROM route_station WHERE train_no = ? AND stop_seq = ?", trainNo, stopSeq) > 0;
    }
}
