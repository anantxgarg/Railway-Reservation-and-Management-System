package com.railway.train.model;
import java.time.LocalDate;

public class TrainRun {
    private Long runId;
    private String trainNo;
    private LocalDate runDate;
    private String status;

    // Getters and Setters
    public Long getRunId() { return runId; }
    public void setRunId(Long runId) { this.runId = runId; }
    public String getTrainNo() { return trainNo; }
    public void setTrainNo(String trainNo) { this.trainNo = trainNo; }
    public LocalDate getRunDate() { return runDate; }
    public void setRunDate(LocalDate runDate) { this.runDate = runDate; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
