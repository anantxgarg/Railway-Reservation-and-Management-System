package com.railway.train.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import com.railway.train.model.TrainCoach;

@Repository
public class TrainCoachRepository {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final RowMapper<TrainCoach> rowMapper = (rs, rowNum) -> {
        TrainCoach coach = new TrainCoach();
        coach.setTrainNo(rs.getString("train_no"));
        coach.setCoachNo(rs.getString("coach_no"));
        coach.setClassCode(rs.getString("class_code"));
        return coach;
    };

    public List<TrainCoach> findAll() {
        return jdbcTemplate.query(
                "SELECT train_no, coach_no, class_code FROM train_coach ORDER BY train_no, coach_no",
                rowMapper
        );
    }

    public List<TrainCoach> findByTrainNo(String trainNo) {
        return jdbcTemplate.query(
                "SELECT train_no, coach_no, class_code FROM train_coach WHERE train_no = ? ORDER BY coach_no",
                rowMapper,
                trainNo
        );
    }

    public Optional<TrainCoach> findByTrainNoAndCoachNo(String trainNo, String coachNo) {
        try {
            TrainCoach coach = jdbcTemplate.queryForObject(
                    "SELECT train_no, coach_no, class_code FROM train_coach WHERE train_no = ? AND coach_no = ?",
                    rowMapper,
                    trainNo,
                    coachNo
            );
            return Optional.ofNullable(coach);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public void save(TrainCoach coach) {
        String sql = "INSERT INTO train_coach (train_no, coach_no, class_code) " +
                     "VALUES (?, ?, ?) " +
                     "ON CONFLICT (train_no, coach_no) DO UPDATE SET class_code = EXCLUDED.class_code";
        jdbcTemplate.update(sql, coach.getTrainNo(), coach.getCoachNo(), coach.getClassCode());
    }

    public boolean deleteByTrainNoAndCoachNo(String trainNo, String coachNo) {
        return jdbcTemplate.update("DELETE FROM train_coach WHERE train_no = ? AND coach_no = ?", trainNo, coachNo) > 0;
    }
}
