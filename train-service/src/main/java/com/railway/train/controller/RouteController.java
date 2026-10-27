package com.railway.train.controller;

import java.util.List;
import java.util.Map;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.railway.train.model.Route;
import com.railway.train.service.RouteService;

@RestController
@RequestMapping("/api/routes")
public class RouteController {

    @Autowired
    private RouteService routeService;

    @GetMapping
    public List<Route> getAllRoutes() {
        return routeService.getAllRoutes();
    }

    // one route with its stops and their clock times
    @GetMapping("/{routeId}")
    public ResponseEntity<Route> getRoute(@PathVariable int routeId) {
        return routeService.getRoute(routeId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // insert or update by routeCode
    @PostMapping
    public ResponseEntity<Map<String, Object>> saveRoute(@Valid @RequestBody Route route) {
        int routeId = routeService.saveRoute(route);
        return ResponseEntity.ok(Map.of("message", "Route saved successfully", "routeId", routeId));
    }

    @DeleteMapping("/{routeId}")
    public ResponseEntity<Void> deleteRoute(@PathVariable int routeId) {
        if (routeService.deleteRoute(routeId)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
