package com.railway.train.service;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.railway.train.model.Station;
import com.railway.train.repository.StationRepository;

@Service
public class StationService {

    @Autowired
    private StationRepository stationRepository;

    public List<Station> getAllStations() {
        return stationRepository.findAll();
    }

    public Optional<Station> getStationByCode(String stationCode) {
        return stationRepository.findByCode(stationCode);
    }

    public void saveStation(Station station) {
        stationRepository.save(station);
    }

    public boolean deleteStation(String stationCode) {
        return stationRepository.deleteByCode(stationCode);
    }
}
