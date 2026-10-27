package com.railway.train.model;

import jakarta.validation.constraints.NotBlank;

public class TrainCoach {
    @NotBlank(message = "is required")
    private String trainNo;
    @NotBlank(message = "is required")
    private String coachNo;
    @NotBlank(message = "is required")
    private String classCode;

    public TrainCoach() {}

    public TrainCoach(String trainNo, String coachNo, String classCode) {
        this.trainNo = trainNo;
        this.coachNo = coachNo;
        this.classCode = classCode;
    }

    public String getTrainNo() { return trainNo; }
    public void setTrainNo(String trainNo) { this.trainNo = trainNo; }
    public String getCoachNo() { return coachNo; }
    public void setCoachNo(String coachNo) { this.coachNo = coachNo; }
    public String getClassCode() { return classCode; }
    public void setClassCode(String classCode) { this.classCode = classCode; }
}
