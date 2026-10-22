package com.railway.train.model;
import java.math.BigDecimal;
import java.time.LocalTime;

public class RouteStation {
    private String routeId;
    private int stopSeq;
    private String stationCode;
    private BigDecimal distanceKm;
    private LocalTime arrivalTime;
    private LocalTime departureTime;

    // Getters and Setters
    public String getRouteId() { return routeId; }
    public void setRouteId(String routeId) { this.routeId = routeId; }
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