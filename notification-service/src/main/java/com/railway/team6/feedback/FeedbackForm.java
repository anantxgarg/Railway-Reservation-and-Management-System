package com.railway.team6.feedback;

import java.util.Map;

/*
 * What GET /api/feedback/form returns: everything the frontend needs to draw step 1 of the
 * feedback form (the "Journey Details" card).
 *
 *   journey          = train, route, date, times, passenger, coach, seat (copied from the
 *                      JOURNEY_COMPLETED notification)
 *   alreadySubmitted = true if this user already rated this PNR, so the frontend can show
 *                      "Thanks, feedback received" instead of the form.
 */
public record FeedbackForm(
        String userId,
        String pnr,
        Map<String, Object> journey,
        boolean alreadySubmitted
) {
}
