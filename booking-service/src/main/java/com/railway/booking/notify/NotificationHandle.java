package com.railway.booking.notify;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;

/*
 * Copied from Team 6 (notification-service/.../notification/NotificationHandle.java), as their
 * guide asks; only the package line differs. booking-service uses sendRaw() to deliver the
 * notification_outbox rows (see NotificationOutboxJob). Keep the two copies the same.
 *
 * ============================================================================================
 *  THE "HANDLE" FOR OTHER TEAMS: copy this one file into your Spring Boot project.
 * ============================================================================================
 *
 * Instead of building the JSON yourself, create one NotificationHandle and call the method
 * for the event that just happened. It sends the JSON to Team 6's POST /api/notifications.
 *
 *   // once, e.g. as a field in your service:
 *   NotificationHandle notify = new NotificationHandle("http://localhost:8086", "team-2");
 *
 *   // after a booking has been saved in YOUR database:
 *   notify.bookingConfirmed(userId, pnr, "12301", "Rajdhani Express", "2026-12-15",
 *                           "NDLS", "BCT", "3A", 2, "CNF");
 *
 * Rules:
 *   - Call it AFTER your own work has been saved successfully.
 *   - It never throws. If Team 6's server is down it logs a warning and returns false,
 *     so a notification problem can never break your booking or payment.
 *   - Dates are "yyyy-MM-dd", times are "HH:mm", money is a number in INR.
 *
 * (Only needs spring-boot-starter-webmvc, which every team already has. If you copy it, change the
 *  "package" line at the top to your own package.)
 */
public class NotificationHandle {

    // A logger prints messages to the console, with time and class name. Better than System.out.println.
    private static final Logger log = LoggerFactory.getLogger(NotificationHandle.class);

    private final RestClient restClient;  // Spring's tool for making HTTP calls to another server
    private final String sourceTeam;

    /*
     * team6BaseUrl: where Team 6's backend runs, e.g. "http://localhost:8086"
     * sourceTeam:   your team's name, shown in our log, e.g. "team-2"
     */
    public NotificationHandle(String team6BaseUrl, String sourceTeam) {
        this(team6BaseUrl, sourceTeam, null);
    }

    /*
     * internalKey: the NOTIFICATIONS_API_KEY Team 6 was started with, sent as "X-Internal-Key".
     *              null or empty when Team 6 runs without a key (development).
     */
    public NotificationHandle(String team6BaseUrl, String sourceTeam, String internalKey) {
        RestClient.Builder builder = RestClient.builder().baseUrl(team6BaseUrl);
        if (internalKey != null && !internalKey.isBlank()) {
            builder.defaultHeader("X-Internal-Key", internalKey);
        }
        this.restClient = builder.build();
        this.sourceTeam = sourceTeam;
    }

    // 1. Booking team: a booking was made. bookingStatus = "CNF", "RAC", "WL" or "PARTIAL".
    public boolean bookingConfirmed(String userId, String pnr, String trainNumber, String trainName,
                                    String journeyDate, String fromStation, String toStation,
                                    String travelClass, int passengerCount, String bookingStatus) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("trainNumber", trainNumber);
        data.put("trainName", trainName);
        data.put("journeyDate", journeyDate);
        data.put("fromStation", fromStation);
        data.put("toStation", toStation);
        data.put("travelClass", travelClass);
        data.put("passengerCount", passengerCount);
        data.put("bookingStatus", bookingStatus);
        return send("BOOKING_CONFIRMED", userId, pnr, data);
    }

    // 2. Booking / Cancellation team: some or all passengers were cancelled. reason may be null.
    public boolean bookingCancelled(String userId, String pnr, String trainNumber, String journeyDate,
                                    int cancelledPassengers, double refundAmount, String reason) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("trainNumber", trainNumber);
        data.put("journeyDate", journeyDate);
        data.put("cancelledPassengers", cancelledPassengers);
        data.put("refundAmount", refundAmount);
        data.put("reason", reason);
        return send("BOOKING_CANCELLED", userId, pnr, data);
    }

    // 3. Payments team: Razorpay payment succeeded. paidAt = "yyyy-MM-ddTHH:mm:ss".
    public boolean paymentConfirmed(String userId, String pnr, String razorpayPaymentId,
                                    String razorpayOrderId, double amount, String paidAt) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("razorpayPaymentId", razorpayPaymentId);
        data.put("razorpayOrderId", razorpayOrderId);
        data.put("amount", amount);
        data.put("paidAt", paidAt);
        return send("PAYMENT_CONFIRMED", userId, pnr, data);
    }

    // 4. Scheduler: remind the passenger before the journey.
    public boolean journeyReminder(String userId, String pnr, String trainNumber, String trainName,
                                   String journeyDate, String departureTime, String boardingStation,
                                   String coach, String seat) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("trainNumber", trainNumber);
        data.put("trainName", trainName);
        data.put("journeyDate", journeyDate);
        data.put("departureTime", departureTime);
        data.put("boardingStation", boardingStation);
        data.put("coach", coach);
        data.put("seat", seat);
        return send("JOURNEY_REMINDER", userId, pnr, data);
    }

    // 5. Waitlist team: a passenger moved from waitlist to RAC, e.g. oldStatus "WL 12", newStatus "RAC 4".
    public boolean waitlistToRac(String userId, String pnr, String passengerName,
                                 String oldStatus, String newStatus) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("passengerName", passengerName);
        data.put("oldStatus", oldStatus);
        data.put("newStatus", newStatus);
        return send("WL_TO_RAC", userId, pnr, data);
    }

    // 6. Waitlist team: an RAC passenger got a confirmed seat.
    public boolean racToConfirmed(String userId, String pnr, String passengerName,
                                  String oldStatus, String coach, String seat) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("passengerName", passengerName);
        data.put("oldStatus", oldStatus);
        data.put("coach", coach);
        data.put("seat", seat);
        return send("RAC_TO_CNF", userId, pnr, data);
    }

    // 7. Train status team: the train reached the passenger's destination. This opens the feedback form.
    public boolean journeyCompleted(String userId, String pnr, String trainNumber, String trainName,
                                    String journeyDate, String fromStation, String toStation,
                                    String departureTime, String arrivalTime,
                                    String passengerName, String coach, String seat) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("trainNumber", trainNumber);
        data.put("trainName", trainName);
        data.put("journeyDate", journeyDate);
        data.put("fromStation", fromStation);
        data.put("toStation", toStation);
        data.put("departureTime", departureTime);
        data.put("arrivalTime", arrivalTime);
        data.put("passengerName", passengerName);
        data.put("coach", coach);
        data.put("seat", seat);
        return send("JOURNEY_COMPLETED", userId, pnr, data);
    }

    /*
     * Shared by all 7 methods above: wraps the data in the common fields and POSTs it.
     * Returns true if Team 6 accepted it, false otherwise (never throws).
     */
    private boolean send(String type, String userId, String pnr, Map<String, Object> data) {
        // Current time without fractions of a second, e.g. "2026-10-21T14:30:00".
        String error = sendRaw(type, userId, pnr, data, LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS));
        if (error != null) {
            // Server down, or our request was rejected (e.g. a required field missing). Log and move on.
            log.warn("Team 6 notification {} for PNR {} failed: {}", type, pnr, error);
        }
        return error == null;
    }

    /*
     * For senders that already have the "data" map, e.g. booking-service delivering the events
     * other teams wrote to the notification_outbox table. Never throws.
     * Returns null if Team 6 accepted it, otherwise why it failed (so the sender can retry later).
     */
    public String sendRaw(String type, String userId, String pnr, Map<String, Object> data, LocalDateTime eventTime) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("type", type);
        body.put("userId", userId);
        body.put("pnr", pnr);
        body.put("sourceTeam", sourceTeam);
        body.put("eventTime", eventTime.truncatedTo(ChronoUnit.SECONDS).toString());
        body.put("data", data);

        try {
            restClient.post()
                    .uri("/api/notifications")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)                // the Map is turned into JSON automatically
                    .retrieve()                // send it; a 4xx/5xx reply becomes an exception
                    .toBodilessEntity();       // we don't need the reply body
            return null;
        } catch (RestClientException e) {
            return e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
        }
    }
}
