package com.railway.team6.notification;

import java.util.List;

/*
 * The 7 kinds of notification we accept (same list as frontend/README.md).
 *
 * An "enum" is a fixed list of allowed values. If another team sends a type that isn't
 * in this list, the request is rejected with a 400 error before our code even runs.
 *
 * Each type also remembers:
 *   - sentBy:         which team is expected to send it (only for documentation / the /types endpoint)
 *   - requiredFields: the keys that MUST be inside the "data" object for this type.
 *                     NotificationController checks these before saving.
 */
public enum NotificationType {

    BOOKING_CONFIRMED("Booking team", List.of(
            "trainNumber", "trainName", "journeyDate", "fromStation", "toStation",
            "travelClass", "passengerCount", "bookingStatus")),

    // "reason" is optional, so it is not listed here.
    BOOKING_CANCELLED("Booking / Cancellation team", List.of(
            "trainNumber", "journeyDate", "cancelledPassengers", "refundAmount")),

    PAYMENT_CONFIRMED("Payments team", List.of(
            "razorpayPaymentId", "razorpayOrderId", "amount", "paidAt")),

    JOURNEY_REMINDER("Scheduler (Team 6 if no one else)", List.of(
            "trainNumber", "trainName", "journeyDate", "departureTime", "boardingStation", "coach", "seat")),

    WL_TO_RAC("Booking / Waitlist team", List.of(
            "passengerName", "oldStatus", "newStatus")),

    RAC_TO_CNF("Booking / Waitlist team", List.of(
            "passengerName", "oldStatus", "coach", "seat")),

    // This one opens the feedback form, so it carries everything the form's "Journey Details" card shows.
    JOURNEY_COMPLETED("Train status team (Siddhi's group)", List.of(
            "trainNumber", "trainName", "journeyDate", "fromStation", "toStation",
            "departureTime", "arrivalTime", "passengerName", "coach", "seat"));

    private final String sentBy;
    private final List<String> requiredFields;

    // An enum's constructor runs once for each value above, e.g. BOOKING_CONFIRMED("Booking team", ...).
    NotificationType(String sentBy, List<String> requiredFields) {
        this.sentBy = sentBy;
        this.requiredFields = requiredFields;
    }

    public String getSentBy() {
        return sentBy;
    }

    public List<String> getRequiredFields() {
        return requiredFields;
    }
}
