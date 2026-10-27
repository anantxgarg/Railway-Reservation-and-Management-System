package com.railway.train.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class Train {
    @NotBlank(message = "is required")
    @Pattern(regexp = "\\d{4,5}", message = "must be 4 or 5 digits, e.g. 12952")
    private String trainNo;
    @NotBlank(message = "is required")
    private String trainName;
    // Express, Slow or High-Speed (train_type_enum)
    @Pattern(regexp = "Express|Slow|High-Speed", message = "must be Express, Slow or High-Speed")
    private String trainType;
    private Boolean isActive;

    public Train() {}

    public Train(String trainNo, String trainName, String trainType, Boolean isActive) {
        this.trainNo = trainNo;
        this.trainName = trainName;
        this.trainType = trainType;
        this.isActive = isActive;
    }

    public String getTrainNo() { return trainNo; }
    public void setTrainNo(String trainNo) { this.trainNo = trainNo; }
    public String getTrainName() { return trainName; }
    public void setTrainName(String trainName) { this.trainName = trainName; }
    public String getTrainType() { return trainType; }
    public void setTrainType(String trainType) { this.trainType = trainType; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
}
