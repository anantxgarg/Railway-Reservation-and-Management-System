package com.railway.train.service;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.railway.train.model.TrainCoach;
import com.railway.train.repository.TrainCoachRepository;

@Service
public class CoachService {

    @Autowired
    private TrainCoachRepository coachRepository;

    public List<TrainCoach> getAllCoaches() {
        return coachRepository.findAll();
    }

    public List<TrainCoach> getCoachesByTrainNo(String trainNo) {
        return coachRepository.findByTrainNo(trainNo);
    }

    public Optional<TrainCoach> getCoach(String trainNo, String coachNo) {
        return coachRepository.findByTrainNoAndCoachNo(trainNo, coachNo);
    }

    public void saveCoach(TrainCoach coach) {
        coachRepository.save(coach);
    }

    public boolean deleteCoach(String trainNo, String coachNo) {
        return coachRepository.deleteByTrainNoAndCoachNo(trainNo, coachNo);
    }
}
