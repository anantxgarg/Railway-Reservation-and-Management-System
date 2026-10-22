package com.railway.train.model;

public class Train {
    private String trainNo;
    private String trainName;

    public Train() {}

    public Train(String trainNo, String trainName) {
        this.trainNo = trainNo;
        this.trainName = trainName;
    }

    public String getTrainNo() { return trainNo; }
    public void setTrainNo(String trainNo) { this.trainNo = trainNo; }
    public String getTrainName() { return trainName; }
    public void setTrainName(String trainName) { this.trainName = trainName; }
}
