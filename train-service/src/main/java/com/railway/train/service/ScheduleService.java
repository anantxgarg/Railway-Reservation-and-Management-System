package com.railway.train.service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.TextStyle;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.railway.train.error.ApiException;
import com.railway.train.model.RunStatusUpdate;
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

    public List<TrainSchedule> getSchedulesByTrainNo(String trainNo) {
        return scheduleRepository.findByTrainNo(trainNo);
    }

    public Optional<TrainSchedule> getSchedule(String trainNo, String runDay) {
        return scheduleRepository.findByTrainNoAndDay(trainNo, fullDayName(runDay));
    }

    public void saveSchedule(TrainSchedule schedule) {
        schedule.setRunDay(fullDayName(schedule.getRunDay()));
        scheduleRepository.save(schedule);
    }

    public boolean deleteSchedule(String trainNo, String runDay) {
        return scheduleRepository.deleteByTrainNoAndDay(trainNo, fullDayName(runDay));
    }

    public List<TrainRun> getAllRuns() {
        return runRepository.findAll();
    }

    public Optional<TrainRun> getRunById(Integer runId) {
        return runRepository.findById(runId);
    }

    public List<TrainRun> getRunsByTrainNo(String trainNo) {
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

    /** Runs for every scheduled day of the next `days` days that don't exist yet. */
    public int generateRuns(int days) {
        if (days < 1 || days > 120) {
            throw ApiException.invalid("days must be between 1 and 120");
        }
        return runRepository.generate(days);
    }

    /**
     * Staff report where a run is: its status and delay. Marking it ARRIVED
     * also queues Team 6's "journey completed" notification for every paid
     * booking on it, in the same transaction (which opens their feedback form).
     * Returns the run and how many notifications were queued.
     */
    @Transactional
    public RunUpdated updateRunStatus(int runId, RunStatusUpdate update) {
        if (!runRepository.updateStatus(runId, update.status(), update.delayMinutes())) {
            throw ApiException.notFound("Train run " + runId + " not found");
        }
        int notified = "ARRIVED".equals(update.status()) ? runRepository.queueJourneyCompleted(runId) : 0;
        return new RunUpdated(runRepository.findById(runId).orElseThrow(), notified);
    }

    public record RunUpdated(TrainRun run, int journeyCompletedNotifications) {
    }

    // The database stores full weekday names ("Monday"); Team 2's first API
    // used "MON", so both are accepted.
    static String fullDayName(String day) {
        if (day == null) {
            return null;
        }
        String wanted = day.trim().toUpperCase(Locale.ROOT);
        for (DayOfWeek d : DayOfWeek.values()) {
            if (d.name().equals(wanted) || d.name().startsWith(wanted) && wanted.length() == 3) {
                return d.getDisplayName(TextStyle.FULL, Locale.ENGLISH);
            }
        }
        throw ApiException.invalid("Unknown weekday " + day + "; use Monday ... Sunday or MON ... SUN");
    }
}
