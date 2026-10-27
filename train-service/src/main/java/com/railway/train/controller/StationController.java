package com.railway.train.controller;

import java.util.List;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.railway.train.model.Station;
import com.railway.train.service.StationService;

@RestController
@RequestMapping("/api/stations")
public class StationController {

    @Autowired
    private StationService stationService;

    @GetMapping
    public List<Station> getAllStations() {
        return stationService.getAllStations();
    }

    @GetMapping("/{stationCode}")
    public ResponseEntity<Station> getStationByCode(@PathVariable String stationCode) {
        return stationService.getStationByCode(stationCode)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<String> saveStation(@Valid @RequestBody Station station) {
        stationService.saveStation(station);
        return ResponseEntity.ok("Station saved successfully");
    }

    @DeleteMapping("/{stationCode}")
    public ResponseEntity<Void> deleteStation(@PathVariable String stationCode) {
        if (stationService.deleteStation(stationCode)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
