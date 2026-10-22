package com.railway.train.controller;

import java.time.LocalDate;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.railway.train.model.TrainRun;
import com.railway.train.model.TrainSchedule;
import com.railway.train.service.ScheduleService;

@RestController
@RequestMapping("/api/schedules")
@CrossOrigin(origins = "*")
public class ScheduleController {

    @Autowired
    private ScheduleService scheduleService;

    // --- Train Schedules ---

    @GetMapping
    public List<TrainSchedule> getAllSchedules() {
        return scheduleService.getAllSchedules();
    }

    @GetMapping("/train/{trainNo}")
    public List<TrainSchedule> getSchedulesByTrainNo(@PathVariable String trainNo) {
        return scheduleService.getSchedulesByTrainNo(trainNo);
    }

    @GetMapping("/train/{trainNo}/{runDay}")
    public ResponseEntity<TrainSchedule> getSchedule(@PathVariable String trainNo, @PathVariable String runDay) {
        return scheduleService.getSchedule(trainNo, runDay)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<String> saveSchedule(@RequestBody TrainSchedule schedule) {
        scheduleService.saveSchedule(schedule);
        return ResponseEntity.ok("Train schedule saved successfully");
    }

    @DeleteMapping("/train/{trainNo}/{runDay}")
    public ResponseEntity<Void> deleteSchedule(@PathVariable String trainNo, @PathVariable String runDay) {
        if (scheduleService.deleteSchedule(trainNo, runDay)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    // --- Train Runs ---

    @GetMapping("/runs")
    public List<TrainRun> getAllRuns() {
        return scheduleService.getAllRuns();
    }

    @GetMapping("/runs/{runId}")
    public ResponseEntity<TrainRun> getRunById(@PathVariable Long runId) {
        return scheduleService.getRunById(runId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/runs/train/{trainNo}")
    public List<TrainRun> getRunsByTrainNo(@PathVariable String trainNo) {
        return scheduleService.getRunsByTrainNo(trainNo);
    }

    @GetMapping("/runs/date/{date}")
    public List<TrainRun> getRunsByDate(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return scheduleService.getRunsByDate(date);
    }

    @PostMapping("/runs")
    public ResponseEntity<String> saveRun(@RequestBody TrainRun run) {
        scheduleService.saveRun(run);
        return ResponseEntity.ok("Train run saved successfully");
    }

    @DeleteMapping("/runs/{runId}")
    public ResponseEntity<Void> deleteRun(@PathVariable Long runId) {
        if (scheduleService.deleteRun(runId)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
