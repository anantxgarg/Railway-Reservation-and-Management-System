package com.railway.train.service;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.railway.train.model.Route;
import com.railway.train.model.RouteStation;
import com.railway.train.repository.RouteRepository;
import com.railway.train.repository.RouteStationRepository;

@Service
public class RouteService {

    @Autowired
    private RouteRepository routeRepository;

    @Autowired
    private RouteStationRepository routeStationRepository;

    public List<Route> getAllRoutes() {
        return routeRepository.findAll();
    }

    public Optional<Route> getRouteById(String routeId) {
        return routeRepository.findById(routeId);
    }

    public Optional<Route> getRouteByCode(String routeCode) {
        return routeRepository.findByCode(routeCode);
    }

    public void saveRoute(Route route) {
        routeRepository.save(route);
    }

    public boolean deleteRoute(String routeId) {
        return routeRepository.deleteById(routeId);
    }

    public List<RouteStation> getAllRouteStations() {
        return routeStationRepository.findAll();
    }

    public List<RouteStation> getStationsForRoute(String routeId) {
        return routeStationRepository.findByRouteId(routeId);
    }

    public void saveRouteStation(RouteStation routeStation) {
        routeStationRepository.save(routeStation);
    }

    public boolean deleteRouteStation(String routeId, int stopSeq) {
        return routeStationRepository.deleteByRouteIdAndStopSeq(routeId, stopSeq);
    }
}
