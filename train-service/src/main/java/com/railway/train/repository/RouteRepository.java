package com.railway.train.repository;

import java.sql.Time;
import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import com.railway.train.model.Route;

@Repository
public class RouteRepository {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final RowMapper<Route> rowMapper = (rs, rowNum) -> new Route(
            rs.getInt("route_id"),
            rs.getString("route_code"),
            rs.getString("route_name"),
            rs.getTime("departure_time").toLocalTime());

    public List<Route> findAll() {
        return jdbcTemplate.query(
                "SELECT route_id, route_code, route_name, departure_time FROM route ORDER BY route_code", rowMapper);
    }

    public Optional<Route> findById(int routeId) {
        return jdbcTemplate.query(
                "SELECT route_id, route_code, route_name, departure_time FROM route WHERE route_id = ?",
                rowMapper, routeId).stream().findFirst();
    }

    /** Insert or update by route code; returns the route's id. */
    public int save(Route route) {
        String sql = "INSERT INTO route (route_code, route_name, departure_time) VALUES (?, ?, ?) " +
                     "ON CONFLICT (route_code) DO UPDATE SET route_name = EXCLUDED.route_name, " +
                     "departure_time = EXCLUDED.departure_time RETURNING route_id";
        return jdbcTemplate.queryForObject(sql, Integer.class, route.getRouteCode(), route.getRouteName(),
                Time.valueOf(route.getDepartureTime()));
    }

    public boolean deleteById(int routeId) {
        return jdbcTemplate.update("DELETE FROM route WHERE route_id = ?", routeId) > 0;
    }
}
