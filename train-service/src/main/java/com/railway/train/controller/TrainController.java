package com.railway.train.controller;

import java.util.List;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.railway.train.model.Train;
import com.railway.train.service.TrainService;

@RestController
@RequestMapping("/api/trains")
public class TrainController {

    @Autowired
    private TrainService trainService;

    @GetMapping
    public List<Train> getAllTrains() {
        return trainService.getAllTrains();
    }

    @GetMapping("/{trainNo}")
    public ResponseEntity<Train> getTrainByNo(@PathVariable String trainNo) {
        return trainService.getTrainByNo(trainNo)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<String> addTrain(@Valid @RequestBody Train train) {
        trainService.addTrain(train);
        return ResponseEntity.ok("Train added or updated successfully");
    }

    @DeleteMapping("/{trainNo}")
    public ResponseEntity<Void> deleteTrain(@PathVariable String trainNo) {
        if (trainService.removeTrain(trainNo)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
