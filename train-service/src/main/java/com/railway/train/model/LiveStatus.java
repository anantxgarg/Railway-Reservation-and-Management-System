package com.railway.train.model;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Live status of one train run, station by station (GET /api/live-status/...).
 * Scheduled times come from the timetable (route departure + stop offsets);
 * expected times add the run's current delay. Times are ISO-8601 with the
 * Indian offset (+05:30).
 *
 * stop status: DEPARTED, AT_STATION, NEXT, EXPECTED, ARRIVED (last stop
 * reached) or CANCELLED.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record LiveStatus(int runId, String trainNo, String trainName, LocalDate runDate,
                         String runStatus, int delayMinutes, String summary,
                         String pnr, Integer boardingSeq, Integer destinationSeq,
                         List<Stop> stops) {

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Stop(int seq, String stationCode, String stationName, BigDecimal distanceKm, String platform,
                       OffsetDateTime scheduledArrival, OffsetDateTime scheduledDeparture,
                       OffsetDateTime expectedArrival, OffsetDateTime expectedDeparture,
                       String status) {
    }

    public LiveStatus forPnr(String pnr, int boardingSeq, int destinationSeq) {
        return new LiveStatus(runId, trainNo, trainName, runDate, runStatus, delayMinutes, summary,
                pnr, boardingSeq, destinationSeq, stops);
    }
}
