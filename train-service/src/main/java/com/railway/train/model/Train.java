package com.railway.train.model;

public class Train {
    private Integer trainNo;
    private String trainName;
    private Boolean isActive;

    public Train() {}

    public Train(Integer trainNo, String trainName, Boolean isActive) {
        this.trainNo = trainNo;
        this.trainName = trainName;
        this.isActive = isActive;
    }

    public Integer getTrainNo() { return trainNo; }
    public void setTrainNo(Integer trainNo) { this.trainNo = trainNo; }
    public String getTrainName() { return trainName; }
    public void setTrainName(String trainName) { this.trainName = trainName; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
}
