package com.railway.train.service;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.railway.train.model.RouteStation;
import com.railway.train.repository.RouteStationRepository;

@Service
public class RouteStationService {

    @Autowired
    private RouteStationRepository routeStationRepository;

    public List<RouteStation> getAllRouteStations() {
        return routeStationRepository.findAll();
    }

    public List<RouteStation> getStationsForTrain(Integer trainNo) {
        return routeStationRepository.findByTrainNo(trainNo);
    }

    public void saveRouteStation(RouteStation routeStation) {
        routeStationRepository.save(routeStation);
    }

    public boolean deleteRouteStation(Integer trainNo, int stopSeq) {
        return routeStationRepository.deleteByTrainNoAndStopSeq(trainNo, stopSeq);
    }
}
