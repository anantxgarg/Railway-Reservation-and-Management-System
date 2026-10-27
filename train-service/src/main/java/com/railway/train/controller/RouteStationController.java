package com.railway.train.controller;

import java.util.List;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.railway.train.model.RouteStation;
import com.railway.train.service.RouteStationService;

@RestController
@RequestMapping("/api/route-stations")
public class RouteStationController {

    @Autowired
    private RouteStationService routeStationService;

    @GetMapping
    public List<RouteStation> getAllRouteStations() {
        return routeStationService.getAllRouteStations();
    }

    // the stops of every route the train follows, with clock times
    @GetMapping("/train/{trainNo}")
    public List<RouteStation> getStationsForTrain(@PathVariable String trainNo) {
        return routeStationService.getStationsForTrain(trainNo);
    }

    // insert or update the stop (routeId, stopSeq)
    @PostMapping
    public ResponseEntity<String> saveRouteStation(@Valid @RequestBody RouteStation routeStation) {
        routeStationService.saveRouteStation(routeStation);
        return ResponseEntity.ok("Route station saved successfully");
    }

    @DeleteMapping("/route/{routeId}/{stopSeq}")
    public ResponseEntity<Void> deleteRouteStation(@PathVariable int routeId, @PathVariable int stopSeq) {
        if (routeStationService.deleteRouteStation(routeId, stopSeq)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
