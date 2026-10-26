package com.railway.train.model;

public class TrainCoach {
    private Integer trainNo;
    private String coachNo;
    private String classCode;

    public TrainCoach() {}

    public TrainCoach(Integer trainNo, String coachNo, String classCode) {
        this.trainNo = trainNo;
        this.coachNo = coachNo;
        this.classCode = classCode;
    }

    public Integer getTrainNo() { return trainNo; }
    public void setTrainNo(Integer trainNo) { this.trainNo = trainNo; }
    public String getCoachNo() { return coachNo; }
    public void setCoachNo(String coachNo) { this.coachNo = coachNo; }
    public String getClassCode() { return classCode; }
    public void setClassCode(String classCode) { this.classCode = classCode; }
}