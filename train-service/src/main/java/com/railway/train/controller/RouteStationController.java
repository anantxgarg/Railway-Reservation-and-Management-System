package com.railway.train.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.railway.train.model.RouteStation;
import com.railway.train.service.RouteStationService;

@RestController
@RequestMapping({"/api/route-stations", "/api/routes"})
@CrossOrigin(origins = "*")
public class RouteStationController {

    @Autowired
    private RouteStationService routeStationService;

    @GetMapping
    public List<RouteStation> getAllRouteStations() {
        return routeStationService.getAllRouteStations();
    }

    @GetMapping("/train/{trainNo}")
    public List<RouteStation> getStationsForTrain(@PathVariable Integer trainNo) {
        return routeStationService.getStationsForTrain(trainNo);
    }

    @PostMapping
    public ResponseEntity<String> saveRouteStation(@RequestBody RouteStation routeStation) {
        routeStationService.saveRouteStation(routeStation);
        return ResponseEntity.ok("Route station saved successfully");
    }

    @DeleteMapping("/train/{trainNo}/{stopSeq}")
    public ResponseEntity<Void> deleteRouteStation(@PathVariable Integer trainNo, @PathVariable int stopSeq) {
        if (routeStationService.deleteRouteStation(trainNo, stopSeq)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
