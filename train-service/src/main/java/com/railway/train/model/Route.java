package com.railway.train.model;

import java.time.LocalTime;
import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

// A named path through stations. Trains follow a route on the weekdays in
// their schedule; the stops' times count from the route's departure time.
public class Route {
    private Integer routeId;
    @NotBlank(message = "is required")
    private String routeCode;
    @NotBlank(message = "is required")
    private String routeName;
    // leaves the first stop at this time (IST)
    @NotNull(message = "is required")
    private LocalTime departureTime;
    // filled in when one route is read with its stops
    private List<RouteStation> stops;

    public Route() {}

    public Route(Integer routeId, String routeCode, String routeName, LocalTime departureTime) {
        this.routeId = routeId;
        this.routeCode = routeCode;
        this.routeName = routeName;
        this.departureTime = departureTime;
    }

    public Integer getRouteId() { return routeId; }
    public void setRouteId(Integer routeId) { this.routeId = routeId; }
    public String getRouteCode() { return routeCode; }
    public void setRouteCode(String routeCode) { this.routeCode = routeCode; }
    public String getRouteName() { return routeName; }
    public void setRouteName(String routeName) { this.routeName = routeName; }
    public LocalTime getDepartureTime() { return departureTime; }
    public void setDepartureTime(LocalTime departureTime) { this.departureTime = departureTime; }
    public List<RouteStation> getStops() { return stops; }
    public void setStops(List<RouteStation> stops) { this.stops = stops; }
}
