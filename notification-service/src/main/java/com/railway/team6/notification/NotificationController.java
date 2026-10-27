package com.railway.team6.notification;

import jakarta.validation.Valid;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/*
 * The REST API for notifications: the URLs other teams and our React frontend call.
 *
 * @RestController = every method's return value is sent back as JSON.
 * @RequestMapping("/api/notifications") = every URL in this class starts with /api/notifications.
 *
 * Each method reads the request, does the work, and uses NotificationRepository to
 * save to / read from MongoDB.
 *
 * Who calls what:
 *   Other teams (Spring Boot)  -> POST  /api/notifications
 *   Our React frontend         -> GET   /api/notifications/user/{userId}
 *                                 GET   /api/notifications/user/{userId}/unread-count
 *                                 PATCH /api/notifications/{id}/read
 *                                 PATCH /api/notifications/user/{userId}/read-all
 *   Admin / debugging          -> GET   /api/notifications/log
 *   Anyone (documentation)     -> GET   /api/notifications/types
 */
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationRepository repository;

    // "Constructor injection": Spring sees we need a NotificationRepository and passes one in.
    public NotificationController(NotificationRepository repository) {
        this.repository = repository;
    }

    /*
     * POST /api/notifications: the handle other teams call.
     * @RequestBody = turn the JSON body into a NotificationRequest object.
     * @Valid       = check its validation rules first (400 if broken).
     * @ResponseStatus(ACCEPTED) = reply with status 202 instead of the default 200.
     *
     * Steps: 1) check required data fields  2) build title/message  3) save to MongoDB.
     */
    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    public Notification receive(@Valid @RequestBody NotificationRequest request) {
        NotificationType type = request.type();
        Map<String, Object> data = request.data();

        // 1) Find every required key that is missing or empty in "data".
        List<String> missing = type.getRequiredFields().stream()
                .filter(field -> data.get(field) == null || data.get(field).toString().isBlank())
                .toList();
        if (!missing.isEmpty()) {
            // ResponseStatusException = "stop here and reply with this status and message".
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Missing fields inside 'data' for " + type + ": " + missing);
        }

        // 2) Copy everything into a Notification object.
        Notification notification = new Notification();
        notification.setUserId(request.userId());
        notification.setType(type);
        notification.setPnr(request.pnr());
        notification.setSourceTeam(request.sourceTeam());
        notification.setEventTime(request.eventTime());
        notification.setData(data);
        notification.setTitle(buildTitle(type));
        notification.setMessage(buildMessage(type, request.pnr(), data));
        notification.setRead(false);              // new notifications start unread -> bell blinks
        notification.setCreatedAt(Instant.now());

        // 3) save() inserts the document into MongoDB and gives it back with its new "id" filled in.
        return repository.save(notification);
    }

    // GET /api/notifications/user/u_123: that user's notifications, newest first.
    // @PathVariable takes the {userId} part out of the URL.
    @GetMapping("/user/{userId}")
    public List<Notification> getForUser(@PathVariable String userId) {
        return repository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    // GET /api/notifications/user/u_123/unread-count  ->  { "userId": "u_123", "unread": 3 }
    // The frontend polls this (e.g. every 15 s). If "unread" goes up, it makes the bell blink.
    @GetMapping("/user/{userId}/unread-count")
    public Map<String, Object> unreadCount(@PathVariable String userId) {
        return Map.of("userId", userId, "unread", repository.countByUserIdAndReadFalse(userId));
    }

    // PATCH /api/notifications/{id}/read: the user opened/clicked one notification. 404 if the id doesn't exist.
    // (PATCH = "change part of something that already exists".)
    @PatchMapping("/{id}/read")
    public Notification markAsRead(@PathVariable String id) {
        Notification notification = repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "No notification with id " + id));
        notification.setRead(true);
        return repository.save(notification); // save() on an object that has an id = update
    }

    // PATCH /api/notifications/user/u_123/read-all  ->  { "updated": 5 }
    @PatchMapping("/user/{userId}/read-all")
    public Map<String, Object> markAllAsRead(@PathVariable String userId) {
        List<Notification> unread = repository.findByUserIdAndReadFalse(userId);
        unread.forEach(notification -> notification.setRead(true));
        repository.saveAll(unread);
        return Map.of("updated", unread.size());
    }

    // GET /api/notifications/log: every notification, newest first (Admin view).
    @GetMapping("/log")
    public List<Notification> fullLog() {
        return repository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"));
    }

    // GET /api/notifications/types: lists every type, who sends it and its required "data" fields.
    // Handy for other teams to check what to send without opening the README.
    @GetMapping("/types")
    public List<Map<String, Object>> types() {
        return Arrays.stream(NotificationType.values())
                .map(type -> {
                    Map<String, Object> info = new LinkedHashMap<>(); // LinkedHashMap keeps the key order in the JSON
                    info.put("type", type.name());
                    info.put("sentBy", type.getSentBy());
                    info.put("requiredFields", type.getRequiredFields());
                    return info;
                })
                .toList();
    }

    // ---------------------------------------------------------------------------------
    // Helpers that turn the raw data into human-readable text for the notification list.
    // ---------------------------------------------------------------------------------

    // A "switch expression": picks one value based on the type. Java checks that every type is covered.
    private String buildTitle(NotificationType type) {
        return switch (type) {
            case BOOKING_CONFIRMED -> "Booking confirmed";
            case BOOKING_CANCELLED -> "Booking cancelled";
            case PAYMENT_CONFIRMED -> "Payment received";
            case JOURNEY_REMINDER -> "Journey reminder";
            case WL_TO_RAC -> "Waitlist moved to RAC";
            case RAC_TO_CNF -> "RAC ticket confirmed";
            case JOURNEY_COMPLETED -> "Journey completed - rate your trip";
        };
    }

    private String buildMessage(NotificationType type, String pnr, Map<String, Object> d) {
        return switch (type) {
            case BOOKING_CONFIRMED -> "PNR %s: %s %s, %s → %s on %s, class %s, %s passenger(s). Status: %s."
                    .formatted(pnr, d.get("trainNumber"), d.get("trainName"), d.get("fromStation"),
                            d.get("toStation"), d.get("journeyDate"), d.get("travelClass"),
                            d.get("passengerCount"), d.get("bookingStatus"));
            case BOOKING_CANCELLED -> "PNR %s: %s passenger(s) cancelled on train %s (%s). Refund ₹%s."
                    .formatted(pnr, d.get("cancelledPassengers"), d.get("trainNumber"),
                            d.get("journeyDate"), money(d.get("refundAmount")));
            case PAYMENT_CONFIRMED -> "PNR %s: payment of ₹%s received (Razorpay id %s)."
                    .formatted(pnr, money(d.get("amount")), d.get("razorpayPaymentId"));
            case JOURNEY_REMINDER -> "PNR %s: %s %s leaves %s on %s at %s. Coach %s, seat %s."
                    .formatted(pnr, d.get("trainNumber"), d.get("trainName"), d.get("boardingStation"),
                            d.get("journeyDate"), d.get("departureTime"), d.get("coach"), d.get("seat"));
            case WL_TO_RAC -> "PNR %s: %s moved from %s to %s."
                    .formatted(pnr, d.get("passengerName"), d.get("oldStatus"), d.get("newStatus"));
            case RAC_TO_CNF -> "PNR %s: %s is confirmed (was %s). Coach %s, seat %s."
                    .formatted(pnr, d.get("passengerName"), d.get("oldStatus"), d.get("coach"), d.get("seat"));
            case JOURNEY_COMPLETED -> "PNR %s: you reached %s on %s %s. Tap to give feedback."
                    .formatted(pnr, d.get("toStation"), d.get("trainNumber"), d.get("trainName"));
        };
    }

    // Shows money with 2 decimals (655 -> "655.00"). If it isn't a number, show it as it was sent.
    private String money(Object amount) {
        return amount instanceof Number number ? "%.2f".formatted(number.doubleValue()) : String.valueOf(amount);
    }
}
