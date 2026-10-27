package com.railway.train.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import com.railway.train.model.Station;

@Repository
public class StationRepository {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private static final String COLUMNS = "station_code, station_name, city, state, zone, num_platforms";

    private final RowMapper<Station> rowMapper = (rs, rowNum) -> new Station(
            rs.getString("station_code"),
            rs.getString("station_name"),
            rs.getString("city"),
            rs.getString("state"),
            rs.getString("zone"),
            rs.getObject("num_platforms", Integer.class));

    public List<Station> findAll() {
        return jdbcTemplate.query("SELECT " + COLUMNS + " FROM station ORDER BY station_code", rowMapper);
    }

    public Optional<Station> findByCode(String stationCode) {
        try {
            Station station = jdbcTemplate.queryForObject(
                    "SELECT " + COLUMNS + " FROM station WHERE station_code = ?",
                    rowMapper,
                    stationCode
            );
            return Optional.ofNullable(station);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public void save(Station station) {
        String sql = "INSERT INTO station (station_code, station_name, city, state, zone, num_platforms) VALUES (?, ?, ?, ?, ?, ?) " +
                     "ON CONFLICT (station_code) DO UPDATE SET station_name = EXCLUDED.station_name, city = EXCLUDED.city, " +
                     "state = EXCLUDED.state, zone = EXCLUDED.zone, num_platforms = EXCLUDED.num_platforms";
        jdbcTemplate.update(sql, station.getStationCode(), station.getStationName(), station.getCity(),
                station.getState(), station.getZone(), station.getNumPlatforms());
    }

    public boolean deleteByCode(String stationCode) {
        return jdbcTemplate.update("DELETE FROM station WHERE station_code = ?", stationCode) > 0;
    }
}
