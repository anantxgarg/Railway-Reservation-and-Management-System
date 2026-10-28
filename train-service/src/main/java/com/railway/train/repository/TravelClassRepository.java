package com.railway.train.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import com.railway.train.model.TravelClass;

@Repository
public class TravelClassRepository {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final RowMapper<TravelClass> rowMapper = (rs, rowNum) -> {
        TravelClass tc = new TravelClass();
        tc.setClassCode(rs.getString("class_code"));
        tc.setClassName(rs.getString("class_name"));
        tc.setAc(rs.getBoolean("is_ac"));
        tc.setSeatsPerCoach(rs.getInt("seats_per_coach"));
        tc.setBaseFarePerKm(rs.getBigDecimal("base_fare_per_km"));
        tc.setReservationCharge(rs.getBigDecimal("reservation_charge"));
        return tc;
    };

    public List<TravelClass> findAll() {
        return jdbcTemplate.query(
                "SELECT class_code, class_name, is_ac, seats_per_coach, base_fare_per_km, reservation_charge FROM travel_class ORDER BY class_code",
                rowMapper
        );
    }

    public Optional<TravelClass> findByCode(String classCode) {
        try {
            TravelClass travelClass = jdbcTemplate.queryForObject(
                    "SELECT class_code, class_name, is_ac, seats_per_coach, base_fare_per_km, reservation_charge FROM travel_class WHERE class_code = ?",
                    rowMapper,
                    classCode
            );
            return Optional.ofNullable(travelClass);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public void save(TravelClass tc) {
        String sql = "INSERT INTO travel_class (class_code, class_name, is_ac, seats_per_coach, base_fare_per_km, reservation_charge) " +
                     "VALUES (?, ?, ?, ?, ?, ?) " +
                     "ON CONFLICT (class_code) DO UPDATE SET " +
                     "class_name = EXCLUDED.class_name, is_ac = EXCLUDED.is_ac, seats_per_coach = EXCLUDED.seats_per_coach, " +
                     "base_fare_per_km = EXCLUDED.base_fare_per_km, reservation_charge = EXCLUDED.reservation_charge";
        jdbcTemplate.update(sql, tc.getClassCode(), tc.getClassName(), tc.isAc(), tc.getSeatsPerCoach(), tc.getBaseFarePerKm(), tc.getReservationCharge());
    }

    public boolean deleteByCode(String classCode) {
        return jdbcTemplate.update("DELETE FROM travel_class WHERE class_code = ?", classCode) > 0;
    }
}
