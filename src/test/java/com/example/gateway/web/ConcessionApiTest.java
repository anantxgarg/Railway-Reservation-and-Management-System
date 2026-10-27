package com.example.gateway.web;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.time.LocalDate;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Concessions come from the shared concession_rule table; a passenger gets one
 * at booking, and applications send the documents for it.
 */
class ConcessionApiTest extends PaymentApiTestBase {

    /** A HELD booking with passenger 1 on the given concession and passenger 2 without one. */
    private String bookWithConcession(String category, int age) {
        int run = jdbc.queryForObject("SELECT run_id FROM train_run WHERE train_no = '12127' AND run_date = ?",
                Integer.class, LocalDate.now().plusDays(6));
        return jdbc.queryForObject("""
                SELECT create_booking(?, ?, '2S', 'GN', 1, 2, jsonb_build_array(
                    jsonb_build_object('name', 'Passenger 1', 'age', ?::INT, 'gender', 'F', 'concession_id',
                        (SELECT concession_id FROM concession_rule WHERE category = ?)),
                    jsonb_build_object('name', 'Passenger 2', 'age', 30, 'gender', 'M')))""",
                String.class, userId(CUSTOMER), run, age, category);
    }

    private org.springframework.test.web.servlet.ResultActions apply(String pnr, int passenger, String category)
            throws Exception {
        return mvc.perform(post("/api/concessions/apply").header("Authorization", bearer(CUSTOMER))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"pnr": "%s", "passengerId": %d, %s
                         "idCardType": "STUDENT_ID", "idCardNumber": "STU1"}"""
                        .formatted(pnr, passenger, category == null ? "" : "\"category\": \"" + category + "\",")));
    }

    @Test
    void rulesArePublicAndComeFromTheTable() throws Exception {
        mvc.perform(get("/api/concessions/rules"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.category == 'STUDENT')].discountValue").value(25.0))
                .andExpect(jsonPath("$[?(@.category == 'SENIOR_CITIZEN')].minAge").value(60));
    }

    @Test
    void applyForThePassengersConcession() throws Exception {
        String pnr = bookWithConcession("STUDENT", 20);
        int passenger = passengerId(pnr, 1);
        apply(pnr, passenger, null)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.pnr").value(pnr))
                .andExpect(jsonPath("$.passengerId").value(passenger))
                .andExpect(jsonPath("$.passengerName").value("Passenger 1"))
                .andExpect(jsonPath("$.category").value("STUDENT"))
                .andExpect(jsonPath("$.discountPercent").value(25.0))
                .andExpect(jsonPath("$.status").value("PENDING"));

        // the discount is what the booking charged less: the fare of passenger 2, who has none, minus passenger 1's
        double discount = dbValue("""
                SELECT (SELECT passenger_fare FROM passenger WHERE passenger_id = ?)
                     - (SELECT passenger_fare FROM passenger WHERE passenger_id = ?)""",
                Double.class, passengerId(pnr, 2), passenger);
        mvc.perform(get("/api/concessions/booking/{pnr}", pnr).header("Authorization", bearer("staff@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].passengerId").value(passenger))
                .andExpect(jsonPath("$[0].discountAmount").value(discount));

        apply(pnr, passenger, null).andExpect(status().isConflict());
    }

    @Test
    void onlyTheConcessionTheyWereBookedWith() throws Exception {
        String pnr = bookWithConcession("STUDENT", 20);
        apply(pnr, passengerId(pnr, 1), "ARMED_FORCES")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
        apply(pnr, passengerId(pnr, 2), "STUDENT")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value(org.hamcrest.Matchers.containsString("without a concession")));
    }

    @Test
    void passengerMustBeOnTheBooking() throws Exception {
        String pnr = bookWithConcession("STUDENT", 20);
        String other = book(CUSTOMER, 1, 6);
        apply(pnr, passengerId(other, 1), "STUDENT")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
    }

    @Test
    void previewStaysPublic() throws Exception {
        mvc.perform(get("/api/concessions/preview").param("category", "SENIOR_CITIZEN").param("baseFare", "1000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.finalAmount").value(600.0));
        mvc.perform(get("/api/concessions/preview").param("category", "ROYALTY"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void errorsUseTheSharedShape() throws Exception {
        mvc.perform(get("/api/concessions/my"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
        mvc.perform(post("/api/concessions/apply").header("Authorization", bearer(CUSTOMER))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.fields[0].field").exists());
    }
}
