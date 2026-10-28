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

    // Monday first, as in a timetable
    private static final String ORDER = " ORDER BY train_no, array_position(ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']::VARCHAR[], run_day)";

    private final RowMapper<TrainSchedule> rowMapper = (rs, rowNum) -> new TrainSchedule(
            rs.getString("train_no"),
            rs.getString("run_day"),
            rs.getInt("route_id"));

    public List<TrainSchedule> findAll() {
        return jdbcTemplate.query("SELECT train_no, run_day, route_id FROM train_schedule" + ORDER, rowMapper);
    }

    public List<TrainSchedule> findByTrainNo(String trainNo) {
        return jdbcTemplate.query(
                "SELECT train_no, run_day, route_id FROM train_schedule WHERE train_no = ?" + ORDER,
                rowMapper,
                trainNo
        );
    }

    public Optional<TrainSchedule> findByTrainNoAndDay(String trainNo, String runDay) {
        try {
            TrainSchedule schedule = jdbcTemplate.queryForObject(
                    "SELECT train_no, run_day, route_id FROM train_schedule WHERE train_no = ? AND run_day = ?",
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
        String sql = "INSERT INTO train_schedule (train_no, run_day, route_id) " +
                     "VALUES (?, ?, ?) " +
                     "ON CONFLICT (train_no, run_day) DO UPDATE SET route_id = EXCLUDED.route_id";
        jdbcTemplate.update(
                sql,
                schedule.getTrainNo(),
                schedule.getRunDay(),
                schedule.getRouteId()
        );
    }

    public boolean deleteByTrainNoAndDay(String trainNo, String runDay) {
        return jdbcTemplate.update("DELETE FROM train_schedule WHERE train_no = ? AND run_day = ?", trainNo, runDay) > 0;
    }
}
