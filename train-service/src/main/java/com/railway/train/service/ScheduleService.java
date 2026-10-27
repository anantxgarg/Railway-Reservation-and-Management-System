package com.railway.train.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.railway.train.model.TrainRun;
import com.railway.train.model.TrainSchedule;
import com.railway.train.repository.TrainRunRepository;
import com.railway.train.repository.TrainScheduleRepository;

@Service
public class ScheduleService {

    @Autowired
    private TrainScheduleRepository scheduleRepository;

    @Autowired
    private TrainRunRepository runRepository;

    public List<TrainSchedule> getAllSchedules() {
        return scheduleRepository.findAll();
    }

    public List<TrainSchedule> getSchedulesByTrainNo(Integer trainNo) {
        return scheduleRepository.findByTrainNo(trainNo);
    }

    public Optional<TrainSchedule> getSchedule(Integer trainNo, String runDay) {
        return scheduleRepository.findByTrainNoAndDay(trainNo, runDay);
    }

    public void saveSchedule(TrainSchedule schedule) {
        scheduleRepository.save(schedule);
    }

    public boolean deleteSchedule(Integer trainNo, String runDay) {
        return scheduleRepository.deleteByTrainNoAndDay(trainNo, runDay);
    }

    public List<TrainRun> getAllRuns() {
        return runRepository.findAll();
    }

    public Optional<TrainRun> getRunById(Integer runId) {
        return runRepository.findById(runId);
    }

    public List<TrainRun> getRunsByTrainNo(Integer trainNo) {
        return runRepository.findByTrainNo(trainNo);
    }

    public List<TrainRun> getRunsByDate(LocalDate date) {
        return runRepository.findByDate(date);
    }

    public void saveRun(TrainRun run) {
        runRepository.save(run);
    }

    public boolean deleteRun(Integer runId) {
        return runRepository.deleteById(runId);
    }
}
