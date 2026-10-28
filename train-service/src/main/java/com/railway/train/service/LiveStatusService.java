package com.railway.train.service;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import com.railway.train.error.ApiException;
import com.railway.train.model.LiveStatus;
import com.railway.train.repository.LiveStatusRepository;
import com.railway.train.repository.LiveStatusRepository.BookingRef;
import com.railway.train.repository.LiveStatusRepository.RunRow;
import com.railway.train.repository.LiveStatusRepository.StopRow;
import com.railway.train.security.AuthUser;

/**
 * Where a train is, worked out from the timetable, the run's status and its
 * delay (both set by staff with PATCH /api/schedules/runs/{id}/status). There
 * is no GPS feed: a stop counts as left once its expected departure time has
 * passed.
 */
@Service
public class LiveStatusService {

    private static final ZoneId INDIA = ZoneId.of("Asia/Kolkata");

    private final LiveStatusRepository repository;
    private final Clock clock;

    public LiveStatusService(LiveStatusRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    public LiveStatus forRun(int runId) {
        RunRow run = repository.findRun(runId)
                .orElseThrow(() -> ApiException.notFound("Train run " + runId + " not found"));
        List<StopRow> rows = repository.stops(runId);
        if (rows.isEmpty()) {
            throw ApiException.notFound("Train run " + runId + " has no route on its date");
        }

        OffsetDateTime now = OffsetDateTime.now(clock).atZoneSameInstant(INDIA).toOffsetDateTime();
        List<LiveStatus.Stop> stops = new ArrayList<>();
        boolean nextFound = false;
        for (int i = 0; i < rows.size(); i++) {
            StopRow s = rows.get(i);
            boolean last = i == rows.size() - 1;
            OffsetDateTime arrival = local(s.arrival());
            OffsetDateTime departure = last ? null : local(s.departure());
            OffsetDateTime expArrival = plusDelay(arrival, run.delayMinutes());
            OffsetDateTime expDeparture = plusDelay(departure, run.delayMinutes());

            String status;
            if ("CANCELLED".equals(run.status())) {
                status = "CANCELLED";
            } else if ("ARRIVED".equals(run.status())) {
                status = last ? "ARRIVED" : "DEPARTED";
            } else if (!last && expDeparture.isBefore(now) && !nextFound) {
                status = "DEPARTED";
            } else if (last && expArrival.isBefore(now) && !nextFound) {
                status = "ARRIVED";
            } else if (!nextFound) {
                nextFound = true;
                status = expArrival != null && !expArrival.isAfter(now) ? "AT_STATION" : "NEXT";
            } else {
                status = "EXPECTED";
            }
            stops.add(new LiveStatus.Stop(s.seq(), s.stationCode(), s.stationName(), s.distanceKm(), s.platform(),
                    arrival, departure, expArrival, expDeparture, status));
        }
        return new LiveStatus(run.runId(), run.trainNo(), run.trainName(), run.runDate(), run.status(),
                run.delayMinutes(), summary(run), null, null, null, stops);
    }

    /** Live status of the run a PNR is booked on; only its owner, staff and admins may ask. */
    public LiveStatus forPnr(String pnr, AuthUser caller) {
        BookingRef booking = repository.findBooking(pnr)
                .filter(b -> caller.isStaff() || b.userId() == caller.userId())
                // someone else's PNR looks the same as an unknown one
                .orElseThrow(() -> ApiException.notFound("PNR " + pnr + " not found"));
        return forRun(booking.runId()).forPnr(pnr, booking.fromSeq(), booking.toSeq());
    }

    private static String summary(RunRow run) {
        return switch (run.status()) {
            case "CANCELLED" -> "Cancelled";
            case "ARRIVED" -> "Reached its destination";
            default -> run.delayMinutes() > 0 ? "Running " + run.delayMinutes() + " min late" : "On time";
        };
    }

    private static OffsetDateTime local(OffsetDateTime t) {
        return t == null ? null : t.atZoneSameInstant(INDIA).toOffsetDateTime();
    }

    private static OffsetDateTime plusDelay(OffsetDateTime t, int minutes) {
        return t == null ? null : t.plusMinutes(minutes);
    }
}
