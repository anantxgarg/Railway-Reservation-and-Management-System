package com.railway.train.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.railway.train.model.Route;
import com.railway.train.model.RouteStation;
import com.railway.train.service.RouteService;

@RestController
@RequestMapping("/api/routes")
@CrossOrigin(origins = "*")
public class RouteController {

    @Autowired
    private RouteService routeService;

    @GetMapping
    public List<Route> getAllRoutes() {
        return routeService.getAllRoutes();
    }

    @GetMapping("/{routeId}")
    public ResponseEntity<Route> getRouteById(@PathVariable String routeId) {
        return routeService.getRouteById(routeId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<String> saveRoute(@RequestBody Route route) {
        routeService.saveRoute(route);
        return ResponseEntity.ok("Route saved successfully");
    }

    @DeleteMapping("/{routeId}")
    public ResponseEntity<Void> deleteRoute(@PathVariable String routeId) {
        if (routeService.deleteRoute(routeId)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    // --- Route Stations ---

    @GetMapping("/{routeId}/stations")
    public List<RouteStation> getStationsForRoute(@PathVariable String routeId) {
        return routeService.getStationsForRoute(routeId);
    }

    @PostMapping("/{routeId}/stations")
    public ResponseEntity<String> addRouteStation(@PathVariable String routeId, @RequestBody RouteStation routeStation) {
        routeStation.setRouteId(routeId);
        routeService.saveRouteStation(routeStation);
        return ResponseEntity.ok("Route station added successfully");
    }

    @DeleteMapping("/{routeId}/stations/{stopSeq}")
    public ResponseEntity<Void> deleteRouteStation(@PathVariable String routeId, @PathVariable int stopSeq) {
        if (routeService.deleteRouteStation(routeId, stopSeq)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
