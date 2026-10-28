package com.railway.train.model;

import java.math.BigDecimal;
import java.time.LocalTime;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

// One stop on a route. Offsets are minutes after the route leaves its first
// stop; arrivalTime/departureTime are the clock times worked out from them,
// and dayOffset the day the stop is reached (0 = the run date).
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RouteStation {
    // set when stops are listed for a train (vw_train_stops)
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private String trainNo;
    @NotNull(message = "is required")
    private Integer routeId;
    private int stopSeq;
    @NotBlank(message = "is required")
    private String stationCode;
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private String stationName;
    @NotNull(message = "is required")
    @PositiveOrZero(message = "must not be negative")
    private BigDecimal distanceKm;
    // null at the first stop
    private Integer arrivalOffset;
    @NotNull(message = "is required")
    @PositiveOrZero(message = "must not be negative")
    private Integer departureOffset;
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private Integer dayOffset;
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private LocalTime arrivalTime;
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private LocalTime departureTime;
    private String defaultPlatform;

    public RouteStation() {}

    public String getTrainNo() { return trainNo; }
    public void setTrainNo(String trainNo) { this.trainNo = trainNo; }
    public Integer getRouteId() { return routeId; }
    public void setRouteId(Integer routeId) { this.routeId = routeId; }
    public int getStopSeq() { return stopSeq; }
    public void setStopSeq(int stopSeq) { this.stopSeq = stopSeq; }
    public String getStationCode() { return stationCode; }
    public void setStationCode(String stationCode) { this.stationCode = stationCode; }
    public String getStationName() { return stationName; }
    public void setStationName(String stationName) { this.stationName = stationName; }
    public BigDecimal getDistanceKm() { return distanceKm; }
    public void setDistanceKm(BigDecimal distanceKm) { this.distanceKm = distanceKm; }
    public Integer getArrivalOffset() { return arrivalOffset; }
    public void setArrivalOffset(Integer arrivalOffset) { this.arrivalOffset = arrivalOffset; }
    public Integer getDepartureOffset() { return departureOffset; }
    public void setDepartureOffset(Integer departureOffset) { this.departureOffset = departureOffset; }
    public Integer getDayOffset() { return dayOffset; }
    public void setDayOffset(Integer dayOffset) { this.dayOffset = dayOffset; }
    public LocalTime getArrivalTime() { return arrivalTime; }
    public void setArrivalTime(LocalTime arrivalTime) { this.arrivalTime = arrivalTime; }
    public LocalTime getDepartureTime() { return departureTime; }
    public void setDepartureTime(LocalTime departureTime) { this.departureTime = departureTime; }
    public String getDefaultPlatform() { return defaultPlatform; }
    public void setDefaultPlatform(String defaultPlatform) { this.defaultPlatform = defaultPlatform; }
}
