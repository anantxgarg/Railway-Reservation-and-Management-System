package com.railway.train.service;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.railway.train.model.TravelClass;
import com.railway.train.repository.TravelClassRepository;

@Service
public class TravelClassService {

    @Autowired
    private TravelClassRepository travelClassRepository;

    public List<TravelClass> getAllClasses() {
        return travelClassRepository.findAll();
    }

    public Optional<TravelClass> getClassByCode(String classCode) {
        return travelClassRepository.findByCode(classCode);
    }

    public void saveClass(TravelClass travelClass) {
        travelClassRepository.save(travelClass);
    }

    public boolean deleteClass(String classCode) {
        return travelClassRepository.deleteByCode(classCode);
    }
}
