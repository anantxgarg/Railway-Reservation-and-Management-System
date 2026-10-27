package com.railway.train.model;

import java.math.BigDecimal;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

public class TravelClass {
    @NotBlank(message = "is required")
    private String classCode;
    @NotBlank(message = "is required")
    private String className;
    private boolean isAc;
    @Positive(message = "must be more than 0")
    private int seatsPerCoach;
    @NotNull(message = "is required")
    @Positive(message = "must be more than 0")
    private BigDecimal baseFarePerKm;
    @NotNull(message = "is required")
    @PositiveOrZero(message = "must not be negative")
    private BigDecimal reservationCharge;

    public TravelClass() {}

    public TravelClass(String classCode, String className, boolean isAc, int seatsPerCoach, BigDecimal baseFarePerKm, BigDecimal reservationCharge) {
        this.classCode = classCode;
        this.className = className;
        this.isAc = isAc;
        this.seatsPerCoach = seatsPerCoach;
        this.baseFarePerKm = baseFarePerKm;
        this.reservationCharge = reservationCharge;
    }

    public String getClassCode() { return classCode; }
    public void setClassCode(String classCode) { this.classCode = classCode; }
    public String getClassName() { return className; }
    public void setClassName(String className) { this.className = className; }
    @JsonProperty("isAc")
    public boolean isAc() { return isAc; }
    @JsonProperty("isAc")
    public void setAc(boolean ac) { isAc = ac; }
    public int getSeatsPerCoach() { return seatsPerCoach; }
    public void setSeatsPerCoach(int seatsPerCoach) { this.seatsPerCoach = seatsPerCoach; }
    public BigDecimal getBaseFarePerKm() { return baseFarePerKm; }
    public void setBaseFarePerKm(BigDecimal baseFarePerKm) { this.baseFarePerKm = baseFarePerKm; }
    public BigDecimal getReservationCharge() { return reservationCharge; }
    public void setReservationCharge(BigDecimal reservationCharge) { this.reservationCharge = reservationCharge; }
}
