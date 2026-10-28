package com.railway.train.controller;

import java.util.List;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.railway.train.model.TravelClass;
import com.railway.train.service.TravelClassService;

@RestController
@RequestMapping("/api/travel-classes")
public class TravelClassController {

    @Autowired
    private TravelClassService travelClassService;

    @GetMapping
    public List<TravelClass> getAllClasses() {
        return travelClassService.getAllClasses();
    }

    @GetMapping("/{classCode}")
    public ResponseEntity<TravelClass> getClassByCode(@PathVariable String classCode) {
        return travelClassService.getClassByCode(classCode)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<String> saveClass(@Valid @RequestBody TravelClass travelClass) {
        travelClassService.saveClass(travelClass);
        return ResponseEntity.ok("Travel class saved successfully");
    }

    @DeleteMapping("/{classCode}")
    public ResponseEntity<Void> deleteClass(@PathVariable String classCode) {
        if (travelClassService.deleteClass(classCode)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
