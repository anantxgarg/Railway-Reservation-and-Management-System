package com.railway.team6;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class FeedbackApiTest extends ApiTestBase {

    private static final String RATINGS = """
            {"userId":"7","pnr":"1000000016","comment":"AC was too cold.",
             "ratings":{"washroomCleanliness":6,"foodQuality":null,"coachCleaning":7,
                        "electricalAppliances":3,"seatMaterialQuality":7,"bedsheetBlanket":8}}""";

    @Test
    void feedbackOpensOnlyAfterTheJourneyIsCompleted() throws Exception {
        String user = bearer("7", "CUSTOMER");
        mvc.perform(get("/api/feedback/form?userId=7&pnr=1000000016").header("Authorization", user))
                .andExpect(status().isNotFound());

        mvc.perform(post("/api/notifications").header("X-Internal-Key", KEY)
                        .contentType(MediaType.APPLICATION_JSON).content(journeyCompleted("7", "1000000016")))
                .andExpect(status().isAccepted());

        mvc.perform(get("/api/feedback/form?userId=7&pnr=1000000016").header("Authorization", user))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.journey.trainName").value("Mumbai Rajdhani Express"))
                .andExpect(jsonPath("$.alreadySubmitted").value(false));

        mvc.perform(post("/api/feedback").header("Authorization", user)
                        .contentType(MediaType.APPLICATION_JSON).content(RATINGS))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.journey.coach").value("A1"));
        mvc.perform(post("/api/feedback").header("Authorization", user)
                        .contentType(MediaType.APPLICATION_JSON).content(RATINGS))
                .andExpect(status().isConflict());
    }

    @Test
    void onlyThePassengerCanRateTheirJourney() throws Exception {
        mvc.perform(post("/api/notifications").header("X-Internal-Key", KEY)
                .contentType(MediaType.APPLICATION_JSON).content(journeyCompleted("7", "1000000016")));
        mvc.perform(post("/api/feedback").header("Authorization", bearer("8", "CUSTOMER"))
                        .contentType(MediaType.APPLICATION_JSON).content(RATINGS))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/feedback/form?userId=7&pnr=1000000016").header("Authorization", bearer("8", "CUSTOMER")))
                .andExpect(status().isNotFound());
    }

    @Test
    void staffSeeAllFeedbackAndTheAverages() throws Exception {
        mvc.perform(post("/api/notifications").header("X-Internal-Key", KEY)
                .contentType(MediaType.APPLICATION_JSON).content(journeyCompleted("7", "1000000016")));
        mvc.perform(post("/api/feedback").header("Authorization", bearer("7", "CUSTOMER"))
                .contentType(MediaType.APPLICATION_JSON).content(RATINGS));

        mvc.perform(get("/api/feedback/summary?trainNumber=12952").header("Authorization", bearer("7", "CUSTOMER")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/feedback/summary?trainNumber=12952").header("Authorization", bearer("2", "STAFF")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalFeedbacks").value(1))
                .andExpect(jsonPath("$.electricalAppliances").value(3.0))
                .andExpect(jsonPath("$.foodQuality").doesNotExist());
        mvc.perform(get("/api/feedback").header("Authorization", bearer("3", "ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].comment").value("AC was too cold."));
    }

    @Test
    void ratingsAreChecked() throws Exception {
        mvc.perform(post("/api/notifications").header("X-Internal-Key", KEY)
                .contentType(MediaType.APPLICATION_JSON).content(journeyCompleted("7", "1000000016")));
        mvc.perform(post("/api/feedback").header("Authorization", bearer("7", "CUSTOMER"))
                        .contentType(MediaType.APPLICATION_JSON).content(RATINGS.replace("\"coachCleaning\":7", "\"coachCleaning\":11")))
                .andExpect(status().isBadRequest());
    }
}
