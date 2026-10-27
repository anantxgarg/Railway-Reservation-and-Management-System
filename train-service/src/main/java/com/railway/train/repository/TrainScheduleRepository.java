package com.railway.train.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import com.railway.train.model.TrainSchedule;

@Repository
public class TrainScheduleRepository {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final RowMapper<TrainSchedule> rowMapper = (rs, rowNum) -> {
        TrainSchedule schedule = new TrainSchedule();
        schedule.setTrainNo(rs.getInt("train_no"));
        schedule.setRunDay(rs.getString("run_day"));
        return schedule;
    };

    public List<TrainSchedule> findAll() {
        return jdbcTemplate.query(
                "SELECT train_no, run_day FROM train_schedule ORDER BY train_no, run_day",
                rowMapper
        );
    }

    public List<TrainSchedule> findByTrainNo(Integer trainNo) {
        return jdbcTemplate.query(
                "SELECT train_no, run_day FROM train_schedule WHERE train_no = ?",
                rowMapper,
                trainNo
        );
    }

    public Optional<TrainSchedule> findByTrainNoAndDay(Integer trainNo, String runDay) {
        try {
            TrainSchedule schedule = jdbcTemplate.queryForObject(
                    "SELECT train_no, run_day FROM train_schedule WHERE train_no = ? AND run_day = ?",
                    rowMapper,
                    trainNo,
                    runDay
            );
            return Optional.ofNullable(schedule);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public void save(TrainSchedule schedule) {
        String sql = "INSERT INTO train_schedule (train_no, run_day) " +
                     "VALUES (?, ?) " +
                     "ON CONFLICT (train_no, run_day) DO NOTHING";
        jdbcTemplate.update(
                sql,
                schedule.getTrainNo(),
                schedule.getRunDay()
        );
    }

    public boolean deleteByTrainNoAndDay(Integer trainNo, String runDay) {
        return jdbcTemplate.update("DELETE FROM train_schedule WHERE train_no = ? AND run_day = ?", trainNo, runDay) > 0;
    }
}
