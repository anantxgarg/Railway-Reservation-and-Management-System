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

    private static final String COLUMNS = "run_id, train_no, run_date, status, delay_minutes";

    private final RowMapper<TrainRun> rowMapper = (rs, rowNum) -> {
        TrainRun run = new TrainRun();
        run.setRunId(rs.getInt("run_id"));
        run.setTrainNo(rs.getString("train_no"));
        Date d = rs.getDate("run_date");
        run.setRunDate(d != null ? d.toLocalDate() : null);
        run.setStatus(rs.getString("status"));
        run.setDelayMinutes(rs.getInt("delay_minutes"));
        return run;
    };

    public List<TrainRun> findAll() {
        return jdbcTemplate.query(
                "SELECT " + COLUMNS + " FROM train_run ORDER BY run_date DESC, train_no",
                rowMapper
        );
    }

    public Optional<TrainRun> findById(Integer runId) {
        try {
            TrainRun run = jdbcTemplate.queryForObject(
                    "SELECT " + COLUMNS + " FROM train_run WHERE run_id = ?",
                    rowMapper,
                    runId
            );
            return Optional.ofNullable(run);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public List<TrainRun> findByTrainNo(String trainNo) {
        return jdbcTemplate.query(
                "SELECT " + COLUMNS + " FROM train_run WHERE train_no = ? ORDER BY run_date DESC",
                rowMapper,
                trainNo
        );
    }

    public List<TrainRun> findByDate(LocalDate runDate) {
        return jdbcTemplate.query(
                "SELECT " + COLUMNS + " FROM train_run WHERE run_date = ? ORDER BY train_no",
                rowMapper,
                Date.valueOf(runDate)
        );
    }

    public void save(TrainRun run) {
        String sql = "INSERT INTO train_run (train_no, run_date, status, delay_minutes) " +
                     "VALUES (?, ?, ?, ?) " +
                     "ON CONFLICT (train_no, run_date) DO UPDATE SET status = EXCLUDED.status, delay_minutes = EXCLUDED.delay_minutes";
        jdbcTemplate.update(sql, run.getTrainNo(), Date.valueOf(run.getRunDate()),
                run.getStatus() != null ? run.getStatus() : "SCHEDULED",
                run.getDelayMinutes() != null ? run.getDelayMinutes() : 0);
    }

    /** Sets status, and the delay when given; false if there is no such run. */
    public boolean updateStatus(int runId, String status, Integer delayMinutes) {
        return jdbcTemplate.update(
                "UPDATE train_run SET status = ?, delay_minutes = coalesce(?, delay_minutes) WHERE run_id = ?",
                status, delayMinutes, runId) > 0;
    }

    /** Creates the missing runs for every scheduled day from today on; returns how many. */
    public int generate(int days) {
        return jdbcTemplate.update("""
                INSERT INTO train_run (train_no, run_date)
                SELECT s.train_no, CURRENT_DATE + g.day
                FROM generate_series(0, ? - 1) AS g(day)
                JOIN train_schedule s ON s.run_day = to_char(CURRENT_DATE + g.day, 'FMDay')
                JOIN train t ON t.train_no = s.train_no AND t.is_active
                ON CONFLICT (train_no, run_date) DO NOTHING""", days);
    }

    /** Queues Team 6's "journey completed" for the run's paid bookings (C3's queue_journey_completed). */
    public int queueJourneyCompleted(int runId) {
        return jdbcTemplate.queryForObject("SELECT queue_journey_completed(?)", Integer.class, runId);
    }

    public boolean deleteById(Integer runId) {
        return jdbcTemplate.update("DELETE FROM train_run WHERE run_id = ?", runId) > 0;
    }
}
