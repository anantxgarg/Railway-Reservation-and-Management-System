package com.railway.train.model;

public class Route {
    private String routeId;
    private String routeCode;
    private String routeName;

    public Route() {}

    public Route(String routeId, String routeCode, String routeName) {
        this.routeId = routeId;
        this.routeCode = routeCode;
        this.routeName = routeName;
    }

    public String getRouteId() { return routeId; }
    public void setRouteId(String routeId) { this.routeId = routeId; }
    public String getRouteCode() { return routeCode; }
    public void setRouteCode(String routeCode) { this.routeCode = routeCode; }
    public String getRouteName() { return routeName; }
    public void setRouteName(String routeName) { this.routeName = routeName; }
}
