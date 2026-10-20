package com.railway.booking.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.StringJoiner;

import com.jayway.jsonpath.JsonPath;
import com.railway.booking.ApiTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/** POST /api/bookings, GET /api/bookings/{pnr}, GET /api/bookings/mine, POST /api/bookings/{pnr}/cancel. */
class BookingApiTest extends ApiTestBase {

    private static final String CUSTOMER = "customer@example.com";

    @Autowired
    private BookingRepository bookings;

    // ------------------------------------------------------------------ helpers

    private static String passengers(int count) {
        StringJoiner list = new StringJoiner(",", "[", "]");
        for (int i = 1; i <= count; i++) {
            list.add("{\"name\":\"Passenger " + i + "\",\"age\":30,\"gender\":\"M\"}");
        }
        return list.toString();
    }

    private static String request(int runId, String classCode, String from, String to, String passengersJson) {
        return """
                {"runId": %d, "classCode": "%s", "from": "%s", "to": "%s", "passengers": %s}"""
                .formatted(runId, classCode, from, to, passengersJson);
    }

    private ResultActions postBooking(String email, String body) throws Exception {
        return mvc.perform(post("/api/bookings").header(HttpHeaders.AUTHORIZATION, bearer(email))
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private String book(String email, int runId, String classCode, String from, String to, int count)
            throws Exception {
        String body = postBooking(email, request(runId, classCode, from, to, passengers(count)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.pnr");
    }

    private ResultActions getBooking(String email, String pnr) throws Exception {
        return mvc.perform(get("/api/bookings/{pnr}", pnr).header(HttpHeaders.AUTHORIZATION, bearer(email)));
    }

    private ResultActions cancel(String email, String pnr, String body) throws Exception {
        var req = post("/api/bookings/{pnr}/cancel", pnr).header(HttpHeaders.AUTHORIZATION, bearer(email));
        if (body != null) {
            req.contentType(MediaType.APPLICATION_JSON).content(body);
        }
        return mvc.perform(req);
    }

    private int passengerId(String pnr, int passengerNo) {
        return jdbc.queryForObject("SELECT passenger_id FROM v_pnr_status WHERE pnr = ? AND passenger_no = ?",
                Integer.class, pnr, passengerNo);
    }

    // ------------------------------------------------------------------ create

    @Test
    void createHoldsSeatsForFifteenMinutes() throws Exception {
        int run = runId("12622", 6);
        String body = """
                {"runId": %d, "classCode": "3a", "from": "ndls", "to": "NGP", "passengers": [
                  {"name": "  Asha Rao ", "age": 34, "gender": "f"},
                  {"name": "Ravi Rao", "age": 66, "gender": "M"}]}""".formatted(run);
        postBooking(CUSTOMER, body)
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.LOCATION, startsWith("/api/bookings/")))
                .andExpect(jsonPath("$.pnr").value(matchesPattern("\\d{10}")))
                .andExpect(jsonPath("$.status").value("HELD"))
                .andExpect(jsonPath("$.holdExpiresAt").isNotEmpty())
                .andExpect(jsonPath("$.userId").value(userId(CUSTOMER)))
                .andExpect(jsonPath("$.classCode").value("3A"))
                .andExpect(jsonPath("$.quotaCode").value("GN"))
                .andExpect(jsonPath("$.from.code").value("NDLS"))
                .andExpect(jsonPath("$.to.code").value("NGP"))
                .andExpect(jsonPath("$.passengers", hasSize(2)))
                .andExpect(jsonPath("$.passengers[0].name").value("Asha Rao"))
                .andExpect(jsonPath("$.passengers[0].gender").value("F"))
                .andExpect(jsonPath("$.passengers[*].status").value(contains("CONFIRMED", "CONFIRMED")))
                .andExpect(jsonPath("$.passengers[0].label").value(startsWith("CNF/B")))
                .andExpect(jsonPath("$.passengers[0].currentPosition").value(nullValue()))
                // passengers aged 60+ get a lower or side-lower berth
                .andExpect(jsonPath("$.passengers[1].berthType").value(matchesPattern("LB|SL")));

        Integer held = jdbc.queryForObject("""
                SELECT count(*)::INT FROM booking
                WHERE run_id = ? AND status = 'HELD' AND hold_expires_at = created_at + interval '15 minutes'""",
                Integer.class, run);
        assertThat(held).isEqualTo(1);
    }

    @Test
    void availabilityReflectsBookingsOnlyOnTheirPartOfTheRoute() throws Exception {
        int run = runId("12952", 6);
        book(CUSTOMER, run, "3A", "NDLS", "KOTA", 2);
        mvc.perform(get("/api/runs/{id}/availability", run).param("class", "3A").param("from", "NDLS").param("to", "KOTA"))
                .andExpect(jsonPath("$.classes[0].availableSeats").value(190));
        mvc.perform(get("/api/runs/{id}/availability", run).param("class", "3A").param("from", "KOTA").param("to", "BCT"))
                .andExpect(jsonPath("$.classes[0].availableSeats").value(192));
    }

    @Test
    void fullClassPutsPassengersOnTheWaitlistAndCancellationPromotesThem() throws Exception {
        int run = runId("12952", 7); // 1A: 18 berths, no RAC
        String first = book(CUSTOMER, run, "1A", "NDLS", "BCT", 6);
        book(CUSTOMER, run, "1A", "NDLS", "BCT", 6);
        book(CUSTOMER, run, "1A", "NDLS", "BCT", 6);
        String waiting = book(CUSTOMER, run, "1A", "NDLS", "BCT", 2);

        getBooking(CUSTOMER, waiting)
                .andExpect(jsonPath("$.passengers[*].label").value(contains("WL 1", "WL 2")))
                .andExpect(jsonPath("$.passengers[*].currentPosition").value(contains(1, 2)));

        cancel(CUSTOMER, first, "{\"passengerIds\": [%d]}".formatted(passengerId(first, 1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bookingWasPaid").value(false))
                .andExpect(jsonPath("$.cancelled", hasSize(1)))
                .andExpect(jsonPath("$.cancelled[0].previousStatus").value("CONFIRMED"))
                .andExpect(jsonPath("$.booking.status").value("HELD"));

        getBooking(CUSTOMER, waiting)
                .andExpect(jsonPath("$.passengers[0].status").value("CONFIRMED"))
                .andExpect(jsonPath("$.passengers[0].label").value(startsWith("CNF/H1/")))
                .andExpect(jsonPath("$.passengers[1].label").value("WL 1"));
    }

    // ------------------------------------------------------------------ read

    @Test
    void ownerAndStaffCanReadAPnrOtherCustomersCannot() throws Exception {
        String pnr = book(CUSTOMER, runId("12127", 6), "2S", "CSMT", "PUNE", 1);
        getBooking(CUSTOMER, pnr).andExpect(status().isOk()).andExpect(jsonPath("$.pnr").value(pnr));
        getBooking("staff@example.com", pnr).andExpect(status().isOk());
        getBooking("admin@example.com", pnr).andExpect(status().isOk());
        getBooking(otherCustomer(), pnr)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.message").value("PNR " + pnr + " not found"));
        getBooking(CUSTOMER, "0000000000").andExpect(status().isNotFound());
    }

    @Test
    void myBookingsListsOnlyMyBookingsNewestFirst() throws Exception {
        String other = otherCustomer();
        int run = runId("12127", 8);
        String mine = book(CUSTOMER, run, "2S", "CSMT", "PUNE", 2);
        String theirs = book(other, run, "2S", "CSMT", "PUNE", 1);

        mvc.perform(get("/api/bookings/mine").header(HttpHeaders.AUTHORIZATION, bearer(other)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].pnr").value(theirs))
                .andExpect(jsonPath("$[0].fromStation").value("CSMT"))
                .andExpect(jsonPath("$[0].passengers").value(1));
        mvc.perform(get("/api/bookings/mine").header(HttpHeaders.AUTHORIZATION, bearer(CUSTOMER)))
                .andExpect(jsonPath("$[*].pnr").value(contains(mine)));
    }

    // ------------------------------------------------------------------ cancel

    @Test
    void cancelPartOfABookingThenTheRest() throws Exception {
        String pnr = book(CUSTOMER, runId("12622", 9), "SL", "BPL", "MAS", 3);
        cancel(CUSTOMER, pnr, "{\"passengerIds\": [%d, %d]}".formatted(passengerId(pnr, 1), passengerId(pnr, 3)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cancelled[*].passengerId").value(contains(passengerId(pnr, 1), passengerId(pnr, 3))))
                .andExpect(jsonPath("$.booking.status").value("HELD"))
                .andExpect(jsonPath("$.booking.passengers[*].label").value(contains(
                        equalTo("CAN"), startsWith("CNF/S"), equalTo("CAN"))));

        // staff may cancel too; no body means everyone left
        cancel("staff@example.com", pnr, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cancelled", hasSize(1)))
                .andExpect(jsonPath("$.booking.status").value("CANCELLED"));

        cancel(CUSTOMER, pnr, null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("WRONG_STATE"));
    }

    @Test
    void otherCustomersCannotCancel() throws Exception {
        String pnr = book(CUSTOMER, runId("12127", 6), "2S", "CSMT", "PUNE", 1);
        cancel(otherCustomer(), pnr, null).andExpect(status().isNotFound());
        getBooking(CUSTOMER, pnr).andExpect(jsonPath("$.status").value("HELD"));
    }

    @Test
    void cancelRejectsPassengersOfAnotherBooking() throws Exception {
        int run = runId("12127", 6);
        String a = book(CUSTOMER, run, "2S", "CSMT", "PUNE", 1);
        String b = book(CUSTOMER, run, "2S", "CSMT", "PUNE", 1);
        cancel(CUSTOMER, a, "{\"passengerIds\": [%d]}".formatted(passengerId(b, 1)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
    }

    @Test
    void cancelWithAnEmptyListIsRejected() throws Exception {
        String pnr = book(CUSTOMER, runId("12127", 6), "2S", "CSMT", "PUNE", 1);
        cancel(CUSTOMER, pnr, "{\"passengerIds\": []}")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.message").value("no passengers given"));
    }

    // ------------------------------------------------------------------ hold expiry

    @Test
    void unpaidHoldsExpireAndFreeTheirSeats() throws Exception {
        int run = runId("12127", 6);
        String pnr = book(CUSTOMER, run, "2S", "CSMT", "PUNE", 2);
        jdbc.update("UPDATE booking SET hold_expires_at = now() - interval '1 minute' WHERE pnr = ?", pnr);

        new HoldExpiryJob(bookings).run();

        getBooking(CUSTOMER, pnr)
                .andExpect(jsonPath("$.status").value("EXPIRED"))
                .andExpect(jsonPath("$.holdExpiresAt").value(nullValue()))
                .andExpect(jsonPath("$.passengers[*].label").value(contains("CAN", "CAN")));
        assertThat(bookings.expireHolds()).isZero();
    }

    // ------------------------------------------------------------------ bad requests

    @Test
    void requestShapeIsCheckedBeforeTheDatabase() throws Exception {
        int run = runId("12127", 6);
        postBooking(CUSTOMER, request(run, "2S", "CSMT", "PUNE", passengers(7)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.message").value(startsWith("passengers")));
        postBooking(CUSTOMER, request(run, "2S", "CSMT", "PUNE", "[]"))
                .andExpect(status().isBadRequest());
        postBooking(CUSTOMER, "{\"classCode\": \"2S\"}")
                .andExpect(status().isBadRequest());
        postBooking(CUSTOMER, "not json")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Request body is missing or not valid JSON"));
        postBooking(CUSTOMER, request(999999, "2S", "CSMT", "PUNE", passengers(1)))
                .andExpect(status().isNotFound());
        postBooking(CUSTOMER, request(run, "2S", "CSMT", "NDLS", passengers(1)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.message").value("Station NDLS is not on this train's route"));
        postBooking(CUSTOMER, request(run, "2S", "PUNE", "CSMT", passengers(1)))
                .andExpect(status().isUnprocessableEntity());
    }

    /** Rules the database enforces come back as 422 with the rule's name. */
    @Test
    void passengerAgeRule() throws Exception {
        postBooking(CUSTOMER, request(runId("12127", 6), "2S", "CSMT", "PUNE",
                "[{\"name\": \"A\", \"age\": 0, \"gender\": \"M\"}]"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code").value("RULE_VIOLATION"))
                .andExpect(jsonPath("$.error.constraint").value("chk_passenger_age"))
                .andExpect(jsonPath("$.error.message").value("Passenger age must be between 1 and 120"));
    }

    @Test
    void passengerGenderRule() throws Exception {
        postBooking(CUSTOMER, request(runId("12127", 6), "2S", "CSMT", "PUNE",
                "[{\"name\": \"A\", \"age\": 30, \"gender\": \"X\"}]"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.constraint").value("chk_passenger_gender"));
    }

    @Test
    void passengerNameRule() throws Exception {
        postBooking(CUSTOMER, request(runId("12127", 6), "2S", "CSMT", "PUNE",
                "[{\"name\": \"   \", \"age\": 30, \"gender\": \"M\"}]"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.constraint").value("chk_passenger_name"));
    }

    @Test
    void classMustBeOnTheTrain() throws Exception {
        postBooking(CUSTOMER, request(runId("12127", 6), "1A", "CSMT", "PUNE", passengers(1)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.constraint").value("trg_booking_class_on_train"));
    }

    @Test
    void unknownQuota() throws Exception {
        String body = """
                {"runId": %d, "classCode": "2S", "quotaCode": "XX", "from": "CSMT", "to": "PUNE", "passengers": %s}"""
                .formatted(runId("12127", 6), passengers(1));
        postBooking(CUSTOMER, body)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.error.message").value(containsString("XX")));
    }

    @Test
    void unknownConcession() throws Exception {
        postBooking(CUSTOMER, request(runId("12127", 6), "2S", "CSMT", "PUNE",
                "[{\"name\": \"A\", \"age\": 30, \"gender\": \"M\", \"concessionId\": 99999}]"))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void trainsThatHaveLeftCannotBeBooked() throws Exception {
        // the dev data only has runs from today on
        Integer yesterday = jdbc.queryForObject("""
                INSERT INTO train_run (train_no, run_date, status) VALUES ('12127', CURRENT_DATE - 1, 'SCHEDULED')
                RETURNING run_id""", Integer.class);
        postBooking(CUSTOMER, request(yesterday, "2S", "CSMT", "PUNE", passengers(1)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("WRONG_STATE"));
    }

    @Test
    void cancelledRunsCannotBeBooked() throws Exception {
        int run = runId("12127", 6);
        jdbc.update("UPDATE train_run SET status = 'CANCELLED' WHERE run_id = ?", run);
        postBooking(CUSTOMER, request(run, "2S", "CSMT", "PUNE", passengers(1)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.message").value("train run " + run + " is cancelled"));
    }
}
