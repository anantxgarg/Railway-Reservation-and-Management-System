package com.railway.train.model;

import java.time.LocalDate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class TrainRun {
    private Integer runId;
    @NotBlank(message = "is required")
    private String trainNo;
    @NotNull(message = "is required")
    private LocalDate runDate;
    // SCHEDULED, DEPARTED, DELAYED, CANCELLED or ARRIVED
    private String status;
    // minutes behind the timetable, shown by live status
    private Integer delayMinutes;

    public TrainRun() {}

    public TrainRun(Integer runId, String trainNo, LocalDate runDate, String status, Integer delayMinutes) {
        this.runId = runId;
        this.trainNo = trainNo;
        this.runDate = runDate;
        this.status = status;
        this.delayMinutes = delayMinutes;
    }

    public Integer getRunId() { return runId; }
    public void setRunId(Integer runId) { this.runId = runId; }
    public String getTrainNo() { return trainNo; }
    public void setTrainNo(String trainNo) { this.trainNo = trainNo; }
    public LocalDate getRunDate() { return runDate; }
    public void setRunDate(LocalDate runDate) { this.runDate = runDate; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Integer getDelayMinutes() { return delayMinutes; }
    public void setDelayMinutes(Integer delayMinutes) { this.delayMinutes = delayMinutes; }
}
