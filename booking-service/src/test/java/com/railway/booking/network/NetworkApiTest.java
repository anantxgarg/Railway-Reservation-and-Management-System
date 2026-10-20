package com.railway.booking.network;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;

import com.railway.booking.ApiTestBase;
import org.junit.jupiter.api.Test;

/** GET /api/search and GET /api/runs/{runId}/availability against the dev network. */
class NetworkApiTest extends ApiTestBase {

    private static final LocalDate IN_5_DAYS = LocalDate.now().plusDays(5);

    @Test
    void searchFindsTrainsBetweenTwoStationsOnADate() throws Exception {
        mvc.perform(get("/api/search").param("from", "ndls").param("to", "KOTA").param("date", IN_5_DAYS.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].trainNo").value("12952"))
                .andExpect(jsonPath("$[0].runId").value(runId("12952", 5)))
                .andExpect(jsonPath("$[0].from.code").value("NDLS"))
                .andExpect(jsonPath("$[0].to.code").value("KOTA"))
                .andExpect(jsonPath("$[0].distanceKm").value(465.0))
                .andExpect(jsonPath("$[0].classes[*].classCode").value(contains("1A", "2A", "3A")))
                .andExpect(jsonPath("$[0].classes[0].totalSeats").value(18))
                .andExpect(jsonPath("$[0].classes[0].availableSeats").value(18))
                .andExpect(jsonPath("$[0].classes[0].fare").isNumber());
    }

    @Test
    void searchShowsArrivalOnTheNextDay() throws Exception {
        mvc.perform(get("/api/search").param("from", "NDLS").param("to", "MAS").param("date", IN_5_DAYS.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].trainNo").value("12622"))
                .andExpect(jsonPath("$[0].from.date").value(IN_5_DAYS.toString()))
                .andExpect(jsonPath("$[0].to.date").value(IN_5_DAYS.plusDays(1).toString()));
    }

    @Test
    void searchDateIsTheDayTheTrainLeavesTheBoardingStation() throws Exception {
        // the Tamil Nadu Express reaches Nagpur the day after it leaves Delhi
        mvc.perform(get("/api/search").param("from", "NGP").param("to", "MAS").param("date", IN_5_DAYS.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].runDate").value(IN_5_DAYS.minusDays(1).toString()))
                .andExpect(jsonPath("$[0].runId").value(runId("12622", 4)));
    }

    @Test
    void searchInTheWrongDirectionFindsNothing() throws Exception {
        mvc.perform(get("/api/search").param("from", "KOTA").param("to", "NDLS").param("date", IN_5_DAYS.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void searchNeedsAValidDate() throws Exception {
        mvc.perform(get("/api/search").param("from", "NDLS").param("to", "KOTA"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Missing parameter: date"));
        mvc.perform(get("/api/search").param("from", "NDLS").param("to", "KOTA").param("date", "tomorrow"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void availabilityForTheWholeRoute() throws Exception {
        mvc.perform(get("/api/runs/{id}/availability", runId("12952", 5)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trainNo").value("12952"))
                .andExpect(jsonPath("$.from.code").value("NDLS"))
                .andExpect(jsonPath("$.to.code").value("BCT"))
                .andExpect(jsonPath("$.classes", hasSize(3)))
                .andExpect(jsonPath("$.classes[2].classCode").value("3A"))
                .andExpect(jsonPath("$.classes[2].totalSeats").value(192))
                .andExpect(jsonPath("$.classes[2].racCapacity").value(24));
    }

    @Test
    void availabilityForOneClassAndPartOfTheRoute() throws Exception {
        mvc.perform(get("/api/runs/{id}/availability", runId("12622", 5))
                        .param("class", "sl").param("from", "BPL").param("to", "NGP"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.from.seq").value(2))
                .andExpect(jsonPath("$.to.seq").value(3))
                .andExpect(jsonPath("$.classes", hasSize(1)))
                .andExpect(jsonPath("$.classes[0].classCode").value("SL"))
                .andExpect(jsonPath("$.classes[0].availableSeats").value(288));
    }

    @Test
    void availabilityErrors() throws Exception {
        int run = runId("12952", 5);
        mvc.perform(get("/api/runs/{id}/availability", 999999))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/runs/{id}/availability", run).param("from", "MAS"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.message").value("Station MAS is not on this train's route"));
        mvc.perform(get("/api/runs/{id}/availability", run).param("from", "BCT").param("to", "KOTA"))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(get("/api/runs/{id}/availability", run).param("class", "SL"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.message").value("Class SL is not available on train 12952"));
        mvc.perform(get("/api/runs/{id}/availability", "abc"))
                .andExpect(status().isBadRequest());
    }
}
