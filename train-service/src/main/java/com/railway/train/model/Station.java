package com.railway.train.model;

import jakarta.validation.constraints.NotBlank;

public class Station {
    @NotBlank(message = "is required")
    private String stationCode;
    @NotBlank(message = "is required")
    private String stationName;
    @NotBlank(message = "is required")
    private String city;
    @NotBlank(message = "is required")
    private String state;
    private String zone;
    private Integer numPlatforms;

    public Station() {}

    public Station(String stationCode, String stationName, String city, String state, String zone, Integer numPlatforms) {
        this.stationCode = stationCode;
        this.stationName = stationName;
        this.city = city;
        this.state = state;
        this.zone = zone;
        this.numPlatforms = numPlatforms;
    }

    public String getStationCode() { return stationCode; }
    public void setStationCode(String stationCode) { this.stationCode = stationCode; }
    public String getStationName() { return stationName; }
    public void setStationName(String stationName) { this.stationName = stationName; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
    public String getZone() { return zone; }
    public void setZone(String zone) { this.zone = zone; }
    public Integer getNumPlatforms() { return numPlatforms; }
    public void setNumPlatforms(Integer numPlatforms) { this.numPlatforms = numPlatforms; }
}
