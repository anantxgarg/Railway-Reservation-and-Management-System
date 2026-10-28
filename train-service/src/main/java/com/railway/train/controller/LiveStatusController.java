package com.railway.train.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import com.railway.train.model.LiveStatus;
import com.railway.train.security.AuthUser;
import com.railway.train.service.LiveStatusService;

// Live train status for Team 6's live status page.
@RestController
@RequestMapping("/api/live-status")
public class LiveStatusController {

    private final LiveStatusService liveStatusService;

    public LiveStatusController(LiveStatusService liveStatusService) {
        this.liveStatusService = liveStatusService;
    }

    @GetMapping("/run/{runId}")
    public LiveStatus forRun(@PathVariable int runId) {
        return liveStatusService.forRun(runId);
    }

    // the run a PNR is booked on, with its boarding and destination stops marked
    @GetMapping("/pnr/{pnr}")
    public LiveStatus forPnr(@PathVariable String pnr, @AuthenticationPrincipal AuthUser user) {
        return liveStatusService.forPnr(pnr, user);
    }
}
