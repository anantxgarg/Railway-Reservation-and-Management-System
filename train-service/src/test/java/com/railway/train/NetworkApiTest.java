package com.railway.train;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

/** Reading and changing the network: trains, stations, routes, stops, schedules. */
class NetworkApiTest extends ApiTestBase {

    @Test
    void anyoneCanReadTheNetwork() throws Exception {
        mvc.perform(get("/api/trains"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(6)))
                .andExpect(jsonPath("$[*].trainNo", hasItem("16535")))
                .andExpect(jsonPath("$[?(@.trainNo == '12952')].trainType", hasItem("Express")));
        mvc.perform(get("/api/stations/UBL"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stationName").value("Hubballi Junction"))
                .andExpect(jsonPath("$.state").value("Karnataka"));
        mvc.perform(get("/api/travel-classes/CC"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isAc").value(true))
                .andExpect(jsonPath("$.seatsPerCoach").value(78));
        mvc.perform(get("/api/coaches/train/16535"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(4)));
        mvc.perform(get("/api/trains/99999")).andExpect(status().isNotFound());
    }

    @Test
    void stopsOfATrainHaveClockTimes() throws Exception {
        mvc.perform(get("/api/route-stations/train/12952"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(4)))
                .andExpect(jsonPath("$[0].stationCode").value("NDLS"))
                .andExpect(jsonPath("$[0].departureTime").value("16:55:00"))
                .andExpect(jsonPath("$[2].stationName").value("Vadodara Junction"))
                .andExpect(jsonPath("$[2].arrivalTime").value("03:05:00"))
                .andExpect(jsonPath("$[2].dayOffset").value(1));
    }

    @Test
    void schedulesListWeekdaysInOrder() throws Exception {
        mvc.perform(get("/api/schedules/train/16535"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].runDay").value(org.hamcrest.Matchers.contains("Tuesday", "Thursday", "Sunday")));
        mvc.perform(get("/api/schedules/train/16535/TUE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.runDay").value("Tuesday"));
    }

    @Test
    void changesNeedAnAdmin() throws Exception {
        String station = """
                {"stationCode":"LNL","stationName":"Lonavala","city":"Lonavala","state":"Maharashtra"}""";
        mvc.perform(post("/api/stations").contentType(MediaType.APPLICATION_JSON).content(station))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("MISSING_TOKEN"));
        mvc.perform(post("/api/stations").header("Authorization", bearer("customer@example.com"))
                        .contentType(MediaType.APPLICATION_JSON).content(station))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/stations").header("Authorization", bearer("staff@example.com"))
                        .contentType(MediaType.APPLICATION_JSON).content(station))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/stations").header("Authorization", bearer("admin@example.com"))
                        .contentType(MediaType.APPLICATION_JSON).content(station))
                .andExpect(status().isOk());
        mvc.perform(get("/api/stations/LNL")).andExpect(jsonPath("$.city").value("Lonavala"));
    }

    @Test
    void anAdminBuildsANewTrainWithItsRouteAndSchedule() throws Exception {
        String admin = bearer("admin@example.com");
        mvc.perform(post("/api/trains").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"trainNo":"11301","trainName":"Udyan Express","trainType":"Express"}"""))
                .andExpect(status().isOk());
        String routeId = mvc.perform(post("/api/routes").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"routeCode":"CSMT-SUR","routeName":"Mumbai CSMT - Solapur","departureTime":"20:00"}"""))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString().replaceAll(".*\"routeId\":(\\d+).*", "$1");
        for (String stop : new String[] {
                "{\"routeId\":%s,\"stopSeq\":1,\"stationCode\":\"CSMT\",\"distanceKm\":0,\"departureOffset\":0}",
                "{\"routeId\":%s,\"stopSeq\":2,\"stationCode\":\"PUNE\",\"distanceKm\":192,\"arrivalOffset\":200,\"departureOffset\":210}",
                "{\"routeId\":%s,\"stopSeq\":3,\"stationCode\":\"SUR\",\"distanceKm\":454,\"arrivalOffset\":480,\"departureOffset\":480}"}) {
            mvc.perform(post("/api/route-stations").header("Authorization", admin)
                            .contentType(MediaType.APPLICATION_JSON).content(stop.formatted(routeId)))
                    .andExpect(status().isOk());
        }
        // "MON" from Team 2's first API is stored as "Monday"
        mvc.perform(post("/api/schedules").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"trainNo\":\"11301\",\"runDay\":\"MON\",\"routeId\":" + routeId + "}"))
                .andExpect(status().isOk());

        // 20:00 + 480 min = 04:00 the next day
        mvc.perform(get("/api/routes/" + routeId))
                .andExpect(jsonPath("$.stops", hasSize(3)))
                .andExpect(jsonPath("$.stops[2].arrivalTime").value("04:00:00"))
                .andExpect(jsonPath("$.stops[2].dayOffset").value(1));
        mvc.perform(get("/api/schedules/train/11301"))
                .andExpect(jsonPath("$[0].runDay").value("Monday"));
    }

    @Test
    void theDatabaseRulesComeBackAsReadableErrors() throws Exception {
        String admin = bearer("admin@example.com");
        int route = jdbc.queryForObject("SELECT route_id FROM route WHERE route_code = 'PUNE-UBL'", Integer.class);
        // stop 3 nearer than stop 2 (262 km): trg_validate_route_sequence
        mvc.perform(post("/api/route-stations").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"routeId\":" + route + ",\"stopSeq\":3,\"stationCode\":\"BJP\",\"distanceKm\":100,"
                                + "\"arrivalOffset\":405,\"departureOffset\":410}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.constraint").value("trg_validate_route_sequence"));
    }

    @Test
    void aTrainWithRunsCannotBeDeleted() throws Exception {
        mvc.perform(delete("/api/trains/12952").header("Authorization", bearer("admin@example.com")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("IN_USE"));
    }

    @Test
    void badWeekdayAndMissingFieldsAreRejected() throws Exception {
        String admin = bearer("admin@example.com");
        mvc.perform(post("/api/schedules").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"trainNo\":\"12952\",\"runDay\":\"Funday\",\"routeId\":1}"))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(post("/api/stations").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"stationCode\":\"XX\",\"stationName\":\"X\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }
}
