package com.railway.train.service;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.railway.train.model.Train;
import com.railway.train.repository.TrainRepository;

@Service
public class TrainService {

    @Autowired
    private TrainRepository trainRepository;

    public List<Train> getAllTrains() {
        return trainRepository.findAllTrains();
    }

    public Optional<Train> getTrainByNo(Integer trainNo) {
        return trainRepository.findByTrainNo(trainNo);
    }

    public void addTrain(Train train) {
        trainRepository.save(train);
    }

    public boolean removeTrain(Integer trainNo) {
        return trainRepository.deleteByTrainNo(trainNo);
    }
}
