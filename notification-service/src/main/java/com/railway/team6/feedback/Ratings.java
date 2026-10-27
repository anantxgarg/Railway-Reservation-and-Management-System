package com.railway.team6.feedback;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/*
 * The 6 star ratings from the feedback form, each from 1 (Poor) to 10 (Excellent).
 *
 * Used twice:
 *   - inside FeedbackRequest (what the frontend sends), where the rules below are checked, and
 *   - inside Feedback (what we store), where MongoDB saves it as a nested object:
 *       "ratings": { "washroomCleanliness": 6, "foodQuality": null, ... }
 *
 * We use Integer (not int) so a value can be missing (null). foodQuality is the only optional one
 * ("skip if not applicable"); @NotNull makes the others compulsory.
 */
public record Ratings(

        @NotNull(message = "washroomCleanliness is required")
        @Min(value = 1, message = "ratings must be 1-10") @Max(value = 10, message = "ratings must be 1-10")
        Integer washroomCleanliness,

        // Optional: leave it out or send null if no food was served.
        @Min(value = 1, message = "ratings must be 1-10") @Max(value = 10, message = "ratings must be 1-10")
        Integer foodQuality,

        @NotNull(message = "coachCleaning is required")
        @Min(value = 1, message = "ratings must be 1-10") @Max(value = 10, message = "ratings must be 1-10")
        Integer coachCleaning,

        @NotNull(message = "electricalAppliances is required")
        @Min(value = 1, message = "ratings must be 1-10") @Max(value = 10, message = "ratings must be 1-10")
        Integer electricalAppliances,

        @NotNull(message = "seatMaterialQuality is required")
        @Min(value = 1, message = "ratings must be 1-10") @Max(value = 10, message = "ratings must be 1-10")
        Integer seatMaterialQuality,

        @NotNull(message = "bedsheetBlanket is required")
        @Min(value = 1, message = "ratings must be 1-10") @Max(value = 10, message = "ratings must be 1-10")
        Integer bedsheetBlanket
) {
}
