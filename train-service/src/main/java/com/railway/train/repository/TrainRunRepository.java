package com.railway.train.repository;

import java.sql.Date;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import com.railway.train.model.TrainRun;

@Repository
public class TrainRunRepository {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final RowMapper<TrainRun> rowMapper = (rs, rowNum) -> {
        TrainRun run = new TrainRun();
        run.setRunId(rs.getInt("run_id"));
        run.setTrainNo(rs.getInt("train_no"));
        Date d = rs.getDate("run_date");
        run.setRunDate(d != null ? d.toLocalDate() : null);
        run.setStatus(rs.getString("status"));
        return run;
    };

    public List<TrainRun> findAll() {
        return jdbcTemplate.query(
                "SELECT run_id, train_no, run_date, status FROM train_run ORDER BY run_date DESC, train_no",
                rowMapper
        );
    }

    public Optional<TrainRun> findById(Integer runId) {
        try {
            TrainRun run = jdbcTemplate.queryForObject(
                    "SELECT run_id, train_no, run_date, status FROM train_run WHERE run_id = ?",
                    rowMapper,
                    runId
            );
            return Optional.ofNullable(run);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public List<TrainRun> findByTrainNo(Integer trainNo) {
        return jdbcTemplate.query(
                "SELECT run_id, train_no, run_date, status FROM train_run WHERE train_no = ? ORDER BY run_date DESC",
                rowMapper,
                trainNo
        );
    }

    public List<TrainRun> findByDate(LocalDate runDate) {
        return jdbcTemplate.query(
                "SELECT run_id, train_no, run_date, status FROM train_run WHERE run_date = ?",
                rowMapper,
                Date.valueOf(runDate)
        );
    }

    public void save(TrainRun run) {
        String sql = "INSERT INTO train_run (train_no, run_date, status) " +
                     "VALUES (?, ?, ?) " +
                     "ON CONFLICT (train_no, run_date) DO UPDATE SET status = EXCLUDED.status";
        jdbcTemplate.update(sql, run.getTrainNo(), Date.valueOf(run.getRunDate()), run.getStatus() != null ? run.getStatus() : "SCHEDULED");
    }

    public boolean deleteById(Integer runId) {
        return jdbcTemplate.update("DELETE FROM train_run WHERE run_id = ?", runId) > 0;
    }
}
