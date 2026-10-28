package com.railway.train.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import com.railway.train.model.Train;

@Repository
public class TrainRepository {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private static final String COLUMNS = "train_no, train_name, train_type::TEXT AS train_type, is_active";

    private final RowMapper<Train> rowMapper = (rs, rowNum) -> {
        Train train = new Train();
        train.setTrainNo(rs.getString("train_no"));
        train.setTrainName(rs.getString("train_name"));
        train.setTrainType(rs.getString("train_type"));
        train.setIsActive(rs.getBoolean("is_active"));
        return train;
    };

    public List<Train> findAllTrains() {
        return jdbcTemplate.query("SELECT " + COLUMNS + " FROM train ORDER BY train_no", rowMapper);
    }

    public Optional<Train> findByTrainNo(String trainNo) {
        try {
            Train train = jdbcTemplate.queryForObject(
                    "SELECT " + COLUMNS + " FROM train WHERE train_no = ?",
                    rowMapper,
                    trainNo
            );
            return Optional.ofNullable(train);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public void save(Train train) {
        String sql = "INSERT INTO train (train_no, train_name, train_type, is_active) VALUES (?, ?, ?::train_type_enum, ?) " +
                     "ON CONFLICT (train_no) DO UPDATE SET train_name = EXCLUDED.train_name, " +
                     "train_type = EXCLUDED.train_type, is_active = EXCLUDED.is_active";
        jdbcTemplate.update(sql, train.getTrainNo(), train.getTrainName(),
                train.getTrainType() != null ? train.getTrainType() : "Express",
                train.getIsActive() != null ? train.getIsActive() : true);
    }

    public boolean deleteByTrainNo(String trainNo) {
        return jdbcTemplate.update("DELETE FROM train WHERE train_no = ?", trainNo) > 0;
    }
}
