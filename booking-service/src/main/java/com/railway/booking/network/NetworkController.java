package com.railway.booking.network;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

import com.railway.booking.error.ApiException;
import com.railway.booking.network.NetworkModels.ClassAvailability;
import com.railway.booking.network.NetworkModels.Run;
import com.railway.booking.network.NetworkModels.RunAvailability;
import com.railway.booking.network.NetworkModels.SearchResult;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public endpoints: find trains and check availability. Search is a
 * placeholder until Team 2 builds theirs.
 */
@RestController
@RequestMapping("/api")
public class NetworkController {

    private final NetworkRepository network;

    public NetworkController(NetworkRepository network) {
        this.network = network;
    }

    /** GET /api/search?from=NDLS&to=BCT&date=2026-11-02 (date = the day the train leaves "from"). */
    @GetMapping("/search")
    public List<SearchResult> search(@RequestParam String from, @RequestParam String to,
                                     @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return network.search(code(from), code(to), date);
    }

    /**
     * GET /api/runs/{runId}/availability?class=3A&from=NDLS&to=BPL
     * Every parameter is optional; without from/to the whole route is used.
     */
    @GetMapping("/runs/{runId}/availability")
    public RunAvailability availability(@PathVariable int runId,
                                        @RequestParam(name = "class", required = false) String classCode,
                                        @RequestParam(required = false) String from,
                                        @RequestParam(required = false) String to) {
        Run run = network.findRun(runId)
                .orElseThrow(() -> ApiException.notFound("Train run " + runId + " not found"));
        Journey journey = Journey.resolve(network.stopsOfRun(runId), from, to);
        String cls = classCode == null || classCode.isBlank() ? null : code(classCode);

        List<ClassAvailability> classes = network.availability(runId, cls, journey.from().seq(), journey.to().seq());
        if (cls != null && classes.isEmpty()) {
            throw ApiException.invalid("Class " + cls + " is not available on train " + run.trainNo());
        }
        return new RunAvailability(run.runId(), run.trainNo(), run.trainName(), run.runDate(),
                journey.from(), journey.to(), classes);
    }

    private static String code(String value) {
        return value.trim().toUpperCase(Locale.ROOT);
    }
}
