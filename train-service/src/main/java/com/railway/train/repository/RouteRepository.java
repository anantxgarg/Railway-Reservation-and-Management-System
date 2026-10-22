package com.railway.train.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import com.railway.train.model.Route;

@Repository
public class RouteRepository {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final RowMapper<Route> rowMapper = (rs, rowNum) -> {
        Route route = new Route();
        route.setRouteId(rs.getString("route_id"));
        route.setRouteCode(rs.getString("route_code"));
        route.setRouteName(rs.getString("route_name"));
        return route;
    };

    public List<Route> findAll() {
        return jdbcTemplate.query("SELECT route_id, route_code, route_name FROM route ORDER BY route_id", rowMapper);
    }

    public Optional<Route> findById(String routeId) {
        try {
            Route route = jdbcTemplate.queryForObject(
                    "SELECT route_id, route_code, route_name FROM route WHERE route_id = ?",
                    rowMapper,
                    routeId
            );
            return Optional.ofNullable(route);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public Optional<Route> findByCode(String routeCode) {
        try {
            Route route = jdbcTemplate.queryForObject(
                    "SELECT route_id, route_code, route_name FROM route WHERE route_code = ?",
                    rowMapper,
                    routeCode
            );
            return Optional.ofNullable(route);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public void save(Route route) {
        if (route.getRouteId() != null && !route.getRouteId().isBlank()) {
            String sql = "INSERT INTO route (route_id, route_code, route_name) VALUES (?, ?, ?) " +
                         "ON CONFLICT (route_id) DO UPDATE SET route_code = EXCLUDED.route_code, route_name = EXCLUDED.route_name";
            jdbcTemplate.update(sql, route.getRouteId(), route.getRouteCode(), route.getRouteName());
        } else {
            String sql = "INSERT INTO route (route_code, route_name) VALUES (?, ?)";
            jdbcTemplate.update(sql, route.getRouteCode(), route.getRouteName());
        }
    }

    public boolean deleteById(String routeId) {
        return jdbcTemplate.update("DELETE FROM route WHERE route_id = ?", routeId) > 0;
    }
}
