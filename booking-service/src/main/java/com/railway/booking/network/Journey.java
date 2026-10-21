package com.railway.booking.network;

import java.util.List;
import java.util.Locale;

import com.railway.booking.error.ApiException;
import com.railway.booking.network.NetworkModels.Stop;

/** The boarding and leaving stops of a journey on one run. */
public record Journey(Stop from, Stop to) {

    /**
     * Looks up station codes on the run's route. A null or blank code means
     * the first (from) or last (to) stop.
     */
    public static Journey resolve(List<Stop> stops, String fromCode, String toCode) {
        if (stops.isEmpty()) {
            throw ApiException.invalid("This train run has no route on its date");
        }
        Stop from = isBlank(fromCode) ? stops.get(0) : find(stops, fromCode);
        Stop to = isBlank(toCode) ? stops.get(stops.size() - 1) : find(stops, toCode);
        if (from.seq() >= to.seq()) {
            throw ApiException.invalid(from.code() + " must come before " + to.code() + " on this route");
        }
        return new Journey(from, to);
    }

    private static Stop find(List<Stop> stops, String code) {
        String wanted = code.trim().toUpperCase(Locale.ROOT);
        return stops.stream().filter(s -> s.code().equals(wanted)).findFirst()
                .orElseThrow(() -> ApiException.invalid("Station " + wanted + " is not on this train's route"));
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
