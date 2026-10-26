package com.railway.train.model;

import java.time.LocalDate;

public class TrainRun {
    private Integer runId;
    private Integer trainNo;
    private LocalDate runDate;
    private String status;

    public TrainRun() {}

    public TrainRun(Integer runId, Integer trainNo, LocalDate runDate, String status) {
        this.runId = runId;
        this.trainNo = trainNo;
        this.runDate = runDate;
        this.status = status;
    }

    public Integer getRunId() { return runId; }
    public void setRunId(Integer runId) { this.runId = runId; }
    public Integer getTrainNo() { return trainNo; }
    public void setTrainNo(Integer trainNo) { this.trainNo = trainNo; }
    public LocalDate getRunDate() { return runDate; }
    public void setRunDate(LocalDate runDate) { this.runDate = runDate; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
