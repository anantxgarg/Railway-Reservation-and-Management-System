package com.railway.team6.feedback;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/*
 * The JSON body the frontend sends to POST /api/feedback when the user presses "Submit Feedback".
 *
 * The journey details (train, route, seat...) are NOT sent here. We copy them ourselves from the
 * JOURNEY_COMPLETED notification, so a user can't give feedback for a journey they didn't take.
 *
 * Example:
 * {
 *   "userId": "u_123",
 *   "pnr": "4567891234",
 *   "ratings": { "washroomCleanliness": 6, "foodQuality": 6, "coachCleaning": 6,
 *                "electricalAppliances": 3, "seatMaterialQuality": 7, "bedsheetBlanket": 8 },
 *   "comment": "AC was too cold."
 * }
 */
public record FeedbackRequest(

        @NotBlank(message = "userId is required")
        String userId,

        @NotBlank(message = "pnr is required")
        @Pattern(regexp = "\\d{10}", message = "pnr must be exactly 10 digits")
        String pnr,

        // @Valid makes Spring also check the rules written inside Ratings (1-10, required ones).
        @NotNull(message = "ratings are required")
        @Valid
        Ratings ratings,

        // The optional "written message" text box.
        @Size(max = 1000, message = "comment can be at most 1000 characters")
        String comment
) {
}
