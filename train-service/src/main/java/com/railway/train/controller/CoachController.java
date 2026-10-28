package com.railway.train.controller;

import java.util.List;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.railway.train.model.TrainCoach;
import com.railway.train.service.CoachService;

@RestController
@RequestMapping("/api/coaches")
public class CoachController {

    @Autowired
    private CoachService coachService;

    @GetMapping
    public List<TrainCoach> getAllCoaches() {
        return coachService.getAllCoaches();
    }

    @GetMapping("/train/{trainNo}")
    public List<TrainCoach> getCoachesByTrainNo(@PathVariable String trainNo) {
        return coachService.getCoachesByTrainNo(trainNo);
    }

    @GetMapping("/train/{trainNo}/{coachNo}")
    public ResponseEntity<TrainCoach> getCoach(@PathVariable String trainNo, @PathVariable String coachNo) {
        return coachService.getCoach(trainNo, coachNo)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<String> saveCoach(@Valid @RequestBody TrainCoach coach) {
        coachService.saveCoach(coach);
        return ResponseEntity.ok("Coach saved successfully");
    }

    @DeleteMapping("/train/{trainNo}/{coachNo}")
    public ResponseEntity<Void> deleteCoach(@PathVariable String trainNo, @PathVariable String coachNo) {
        if (coachService.deleteCoach(trainNo, coachNo)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
