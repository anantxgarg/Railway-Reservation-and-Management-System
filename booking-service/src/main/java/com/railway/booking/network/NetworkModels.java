package com.railway.booking.network;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/** Response and lookup types for search and availability. */
public final class NetworkModels {

    private NetworkModels() {
    }

    /** A train run: one train on one date. */
    public record Run(int runId, String trainNo, String trainName, LocalDate runDate, String status) {
    }

    /**
     * A stop on a run's route. date is the calendar date the train is there;
     * arrival and departure are timetable clock times in IST (Team 2's
     * route.departure_time plus the stop's offsets). arrival is null at the
     * first stop; search results give only the departure from the boarding
     * stop and the arrival at the destination.
     */
    public record Stop(int seq, String code, String name, LocalDate date, LocalTime arrival, LocalTime departure) {
    }

    /**
     * Availability of one class for one journey. fare is per passenger for the
     * general quota without concession.
     */
    public record ClassAvailability(String classCode, String className, int totalSeats, int availableSeats,
                                    int racCapacity, int racAvailable, int waitlistCount, BigDecimal fare) {
    }

    public record RunAvailability(int runId, String trainNo, String trainName, LocalDate runDate,
                                  Stop from, Stop to, List<ClassAvailability> classes) {
    }

    /** One train found by search, with availability for the searched journey. */
    public record SearchResult(int runId, String trainNo, String trainName, LocalDate runDate,
                               Stop from, Stop to, BigDecimal distanceKm, List<ClassAvailability> classes) {
    }
}
