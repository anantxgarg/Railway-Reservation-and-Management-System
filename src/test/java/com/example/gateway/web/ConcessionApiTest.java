package com.example.gateway.web;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Concession applications are per passenger of a C3 booking. */
class ConcessionApiTest extends PaymentApiTestBase {

    @Test
    void applyForAPassengerOfMyBooking() throws Exception {
        String pnr = book(CUSTOMER, 2, 6);
        int passenger = passengerId(pnr, 2);
        mvc.perform(post("/api/concessions/apply").header("Authorization", bearer(CUSTOMER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"pnr": "%s", "passengerId": %d, "category": "STUDENT",
                                 "idCardType": "STUDENT_ID", "idCardNumber": "STU1"}""".formatted(pnr, passenger)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.pnr").value(pnr))
                .andExpect(jsonPath("$.passengerId").value(passenger))
                .andExpect(jsonPath("$.passengerName").value("Passenger 2"))
                .andExpect(jsonPath("$.status").value("PENDING"));

        mvc.perform(get("/api/concessions/booking/{pnr}", pnr).header("Authorization", bearer("staff@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].passengerId").value(passenger));
    }

    @Test
    void passengerMustBeOnTheBooking() throws Exception {
        String pnr = book(CUSTOMER, 1, 6);
        String other = book(CUSTOMER, 1, 6);
        mvc.perform(post("/api/concessions/apply").header("Authorization", bearer(CUSTOMER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pnr\": \"%s\", \"passengerId\": %d, \"category\": \"STUDENT\"}"
                                .formatted(pnr, passengerId(other, 1))))
                .andExpect(status().isNotFound());
    }

    @Test
    void previewStaysPublic() throws Exception {
        mvc.perform(get("/api/concessions/preview").param("category", "SENIOR_CITIZEN").param("baseFare", "1000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.finalAmount").value(600.0));
    }
}
