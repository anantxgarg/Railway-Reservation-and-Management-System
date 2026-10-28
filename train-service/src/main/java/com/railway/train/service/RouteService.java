package com.railway.train.service;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.railway.train.model.Route;
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

    /** A route with its stops in order. */
    public Optional<Route> getRoute(int routeId) {
        return routeRepository.findById(routeId).map(route -> {
            route.setStops(routeStationRepository.findByRouteId(routeId));
            return route;
        });
    }

    public int saveRoute(Route route) {
        return routeRepository.save(route);
    }

    public boolean deleteRoute(int routeId) {
        return routeRepository.deleteById(routeId);
    }
}
