package com.railway.train.model;

public class TrainSchedule {
    private Integer trainNo;
    private String runDay;

    public TrainSchedule() {}

    public TrainSchedule(Integer trainNo, String runDay) {
        this.trainNo = trainNo;
        this.runDay = runDay;
    }

    public Integer getTrainNo() { return trainNo; }
    public void setTrainNo(Integer trainNo) { this.trainNo = trainNo; }
    public String getRunDay() { return runDay; }
    public void setRunDay(String runDay) { this.runDay = runDay; }
}