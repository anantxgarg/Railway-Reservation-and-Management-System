package com.railway.team6.demo;

import com.railway.team6.feedback.FeedbackRepository;
import com.railway.team6.notification.NotificationHandle;
import com.railway.team6.notification.NotificationRepository;
import com.railway.team6.security.Caller;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/*
AUthor: Aryan Aich

This file helps in testing our backend.
Herein, we hardcoded parameters /api/demo/journey?userId=Thisthis which sends 7 notifications.
This can be also controlled through frontend buttons.

There is also a reset feature. /api/demo/reset.

This can be easily disabled in application.properties.
Just put the demo parameter to "False".
 */
@RestController
@RequestMapping("/api/demo")
@ConditionalOnProperty(name = "team6.demo.enabled", havingValue = "true")
public class DemoController {

    private final NotificationHandle handle;
    private final NotificationRepository notificationRepository;
    private final FeedbackRepository feedbackRepository;

    // @Value("${server.port}") reads our own port (8086) so the handle knows where to send.
    public DemoController(@Value("${server.port}") int port,
                          @Value("${team6.internal-key}") String internalKey,
                          NotificationRepository notificationRepository,
                          FeedbackRepository feedbackRepository) {
        this.handle = new NotificationHandle("http://localhost:" + port, "team-6-demo", internalKey);
        this.notificationRepository = notificationRepository;
        this.feedbackRepository = feedbackRepository;
    }

    /*
     * Plays out one journey, in the order things happen in real life:
     * booking (waitlisted) -> payment -> WL to RAC -> RAC to confirmed -> reminder -> journey completed.
     * Then a cancellation on a second, separate PNR, so all 7 types show up.
     */
    @PostMapping("/journey")
    public Map<String, Object> simulateJourney(@RequestParam String userId) {
        Caller.requireSelfOrStaff(userId);   // a demo journey for yourself (staff: for anyone)
        String pnr = randomPnr();
        String journeyDate = LocalDate.now().toString();          // "yyyy-MM-dd"
        String passenger = "Rahul Kumar";

        int accepted = 0;  // counts how many notifications Team 6 accepted
        // "x ? 1 : 0" adds 1 when the handle returned true.
        accepted += handle.bookingConfirmed(userId, pnr, "12301", "Rajdhani Express", journeyDate,
                "NDLS", "BCT", "3A", 1, "WL") ? 1 : 0;
        accepted += handle.paymentConfirmed(userId, pnr, "pay_demo" + pnr, "order_demo" + pnr, 3440.00,
                LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS).toString()) ? 1 : 0;
        accepted += handle.waitlistToRac(userId, pnr, passenger, "WL 12", "RAC 4") ? 1 : 0;
        accepted += handle.racToConfirmed(userId, pnr, passenger, "RAC 4", "A1", "23") ? 1 : 0;
        accepted += handle.journeyReminder(userId, pnr, "12301", "Rajdhani Express", journeyDate,
                "17:00", "NDLS", "A1", "23") ? 1 : 0;
        accepted += handle.journeyCompleted(userId, pnr, "12301", "Rajdhani Express", journeyDate,
                "NDLS", "BCT", "17:00", "08:35", passenger, "A1", "23") ? 1 : 0;

        // A second booking that gets cancelled, to show BOOKING_CANCELLED too.
        String cancelledPnr = randomPnr();
        accepted += handle.bookingCancelled(userId, cancelledPnr, "12127", journeyDate,
                1, 655.00, "Plans changed") ? 1 : 0;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userId", userId);
        result.put("pnr", pnr);
        result.put("cancelledPnr", cancelledPnr);
        result.put("notificationsAccepted", accepted + " of 7");
        result.put("next", "GET /api/notifications/user/" + userId
                + "  then  GET /api/feedback/form?userId=" + userId + "&pnr=" + pnr);
        return result;
    }

    // Wipes all demo data so you can start the demo again from zero.
    @DeleteMapping("/reset")
    public Map<String, Object> reset() {
        long notifications = notificationRepository.count();
        long feedback = feedbackRepository.count();
        notificationRepository.deleteAll();
        feedbackRepository.deleteAll();
        return Map.of("deletedNotifications", notifications, "deletedFeedback", feedback);
    }

    // A random 10-digit number (1000000000 to 9999999999) to use as a PNR.
    private String randomPnr() {
        return String.valueOf(ThreadLocalRandom.current().nextLong(1_000_000_000L, 10_000_000_000L));
    }
}
