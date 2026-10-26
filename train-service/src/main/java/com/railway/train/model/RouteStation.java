package com.railway.train.model;

import java.math.BigDecimal;
import java.time.LocalTime;

public class RouteStation {
    private Integer trainNo;
    private int stopSeq;
    private String stationCode;
    private BigDecimal distanceKm;
    private LocalTime arrivalTime;
    private LocalTime departureTime;

    public RouteStation() {}

    public RouteStation(Integer trainNo, int stopSeq, String stationCode, BigDecimal distanceKm, LocalTime arrivalTime, LocalTime departureTime) {
        this.trainNo = trainNo;
        this.stopSeq = stopSeq;
        this.stationCode = stationCode;
        this.distanceKm = distanceKm;
        this.arrivalTime = arrivalTime;
        this.departureTime = departureTime;
    }

    public Integer getTrainNo() { return trainNo; }
    public void setTrainNo(Integer trainNo) { this.trainNo = trainNo; }
    public int getStopSeq() { return stopSeq; }
    public void setStopSeq(int stopSeq) { this.stopSeq = stopSeq; }
    public String getStationCode() { return stationCode; }
    public void setStationCode(String stationCode) { this.stationCode = stationCode; }
    public BigDecimal getDistanceKm() { return distanceKm; }
    public void setDistanceKm(BigDecimal distanceKm) { this.distanceKm = distanceKm; }
    public LocalTime getArrivalTime() { return arrivalTime; }
    public void setArrivalTime(LocalTime arrivalTime) { this.arrivalTime = arrivalTime; }
    public LocalTime getDepartureTime() { return departureTime; }
    public void setDepartureTime(LocalTime departureTime) { this.departureTime = departureTime; }
}