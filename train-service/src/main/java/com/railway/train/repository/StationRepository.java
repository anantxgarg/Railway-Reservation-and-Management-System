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

    private final RowMapper<Station> rowMapper = (rs, rowNum) -> {
        Station station = new Station();
        station.setStationCode(rs.getString("station_code"));
        station.setStationName(rs.getString("station_name"));
        return station;
    };

    public List<Station> findAll() {
        return jdbcTemplate.query("SELECT station_code, station_name FROM station ORDER BY station_code", rowMapper);
    }

    public Optional<Station> findByCode(String stationCode) {
        try {
            Station station = jdbcTemplate.queryForObject(
                    "SELECT station_code, station_name FROM station WHERE station_code = ?",
                    rowMapper,
                    stationCode
            );
            return Optional.ofNullable(station);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public void save(Station station) {
        String sql = "INSERT INTO station (station_code, station_name) VALUES (?, ?) " +
                     "ON CONFLICT (station_code) DO UPDATE SET station_name = EXCLUDED.station_name";
        jdbcTemplate.update(sql, station.getStationCode(), station.getStationName());
    }

    public boolean deleteByCode(String stationCode) {
        return jdbcTemplate.update("DELETE FROM station WHERE station_code = ?", stationCode) > 0;
    }
}
