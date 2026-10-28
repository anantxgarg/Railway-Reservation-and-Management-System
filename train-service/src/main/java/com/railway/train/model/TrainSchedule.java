package com.railway.train.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

// One weekday a train runs, and the route it follows that day.
public class TrainSchedule {
    @NotBlank(message = "is required")
    private String trainNo;
    // "Monday" ... "Sunday"; "MON" ... "SUN" are accepted too (ScheduleService turns them into full names)
    @NotBlank(message = "is required")
    private String runDay;
    @NotNull(message = "is required")
    private Integer routeId;

    public TrainSchedule() {}

    public TrainSchedule(String trainNo, String runDay, Integer routeId) {
        this.trainNo = trainNo;
        this.runDay = runDay;
        this.routeId = routeId;
    }

    public String getTrainNo() { return trainNo; }
    public void setTrainNo(String trainNo) { this.trainNo = trainNo; }
    public String getRunDay() { return runDay; }
    public void setRunDay(String runDay) { this.runDay = runDay; }
    public Integer getRouteId() { return routeId; }
    public void setRouteId(Integer routeId) { this.routeId = routeId; }
}
