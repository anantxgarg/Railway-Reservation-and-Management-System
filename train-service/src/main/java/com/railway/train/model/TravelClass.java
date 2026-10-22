package com.railway.train.model;

import java.math.BigDecimal;

public class TravelClass {
    private String classCode;
    private String className;
    private boolean isAc;
    private int seatsPerCoach;
    private BigDecimal baseFarePerKm;
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
    public boolean isAc() { return isAc; }
    public void setAc(boolean ac) { isAc = ac; }
    public int getSeatsPerCoach() { return seatsPerCoach; }
    public void setSeatsPerCoach(int seatsPerCoach) { this.seatsPerCoach = seatsPerCoach; }
    public BigDecimal getBaseFarePerKm() { return baseFarePerKm; }
    public void setBaseFarePerKm(BigDecimal baseFarePerKm) { this.baseFarePerKm = baseFarePerKm; }
    public BigDecimal getReservationCharge() { return reservationCharge; }
    public void setReservationCharge(BigDecimal reservationCharge) { this.reservationCharge = reservationCharge; }
}
