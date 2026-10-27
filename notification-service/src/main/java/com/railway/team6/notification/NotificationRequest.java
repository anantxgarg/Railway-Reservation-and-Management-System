package com.railway.team6.notification;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.time.LocalDateTime;
import java.util.Map;

/*
 * The JSON body another team sends to POST /api/notifications.
 *
 * A "record" is a short way to write a class that just holds data:
 * Java creates the constructor and the getters (type(), userId(), ...) for us.
 *
 * The annotations (@NotNull, @NotBlank, @Pattern) are validation rules. Because the controller
 * marks this parameter with @Valid, Spring checks them first and replies "400 Bad Request"
 * listing what's wrong. Our code never sees a request that breaks these rules.
 *
 * What we expect:
 * {
 *   "type": "BOOKING_CONFIRMED",
 *   "userId": "u_123",
 *   "pnr": "4567891234",
 *   "sourceTeam": "team-2",
 *   "eventTime": "2026-10-21T14:30:00",
 *   "data": { "trainNumber": "12301", ... }
 * }
 */
public record NotificationRequest(

        @NotNull(message = "type is required")
        NotificationType type,

        @NotBlank(message = "userId is required")
        String userId,

        @NotBlank(message = "pnr is required")
        @Pattern(regexp = "\\d{10}", message = "pnr must be exactly 10 digits")
        String pnr,

        @NotBlank(message = "sourceTeam is required")
        String sourceTeam,

        // Spring turns the text "2026-10-21T14:30:00" into a LocalDateTime for us.
        @NotNull(message = "eventTime is required (format yyyy-MM-ddTHH:mm:ss)")
        LocalDateTime eventTime,

        // Which keys must be inside "data" depends on the type, so that check is in NotificationController.
        @NotNull(message = "data is required")
        Map<String, Object> data
) {
}
