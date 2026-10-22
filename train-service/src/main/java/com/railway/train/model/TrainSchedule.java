package com.railway.train.model;
import java.time.LocalTime;

public class TrainSchedule {
    private String trainNo;
    private String runDay;
    private String routeId;
    private LocalTime startTime;

    // Getters and Setters
    public String getTrainNo() { return trainNo; }
    public void setTrainNo(String trainNo) { this.trainNo = trainNo; }
    public String getRunDay() { return runDay; }
    public void setRunDay(String runDay) { this.runDay = runDay; }
    public String getRouteId() { return routeId; }
    public void setRouteId(String routeId) { this.routeId = routeId; }
    public LocalTime getStartTime() { return startTime; }
    public void setStartTime(LocalTime startTime) { this.startTime = startTime; }
}