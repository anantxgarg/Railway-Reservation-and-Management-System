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

    private final RowMapper<Train> rowMapper = (rs, rowNum) -> {
        Train train = new Train();
        train.setTrainNo(rs.getString("train_no"));
        train.setTrainName(rs.getString("train_name"));
        return train;
    };

    public List<Train> findAllTrains() {
        return jdbcTemplate.query("SELECT train_no, train_name FROM train ORDER BY train_no", rowMapper);
    }

    public Optional<Train> findByTrainNo(String trainNo) {
        try {
            Train train = jdbcTemplate.queryForObject(
                    "SELECT train_no, train_name FROM train WHERE train_no = ?",
                    rowMapper,
                    trainNo
            );
            return Optional.ofNullable(train);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public void save(Train train) {
        String sql = "INSERT INTO train (train_no, train_name) VALUES (?, ?) " +
                     "ON CONFLICT (train_no) DO UPDATE SET train_name = EXCLUDED.train_name";
        jdbcTemplate.update(sql, train.getTrainNo(), train.getTrainName());
    }

    public boolean deleteByTrainNo(String trainNo) {
        return jdbcTemplate.update("DELETE FROM train WHERE train_no = ?", trainNo) > 0;
    }
}
