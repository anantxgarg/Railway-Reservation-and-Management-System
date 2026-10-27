package com.railway.team6;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class NotificationApiTest extends ApiTestBase {

    private static final String PAYMENT = """
            {"type":"PAYMENT_CONFIRMED","userId":"7","pnr":"1000000016","sourceTeam":"team-4",
             "eventTime":"2026-10-21T14:29:55",
             "data":{"razorpayPaymentId":"pay_1","razorpayOrderId":"order_1","amount":3440.0,"paidAt":"2026-10-21T14:29:55"}}""";

    @Test
    void servicesSendNotificationsWithTheInternalKey() throws Exception {
        mvc.perform(post("/api/notifications").contentType(MediaType.APPLICATION_JSON).content(PAYMENT))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/notifications").header("Authorization", bearer("7", "CUSTOMER"))
                        .contentType(MediaType.APPLICATION_JSON).content(PAYMENT))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/notifications").header("X-Internal-Key", "wrong")
                        .contentType(MediaType.APPLICATION_JSON).content(PAYMENT))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/notifications").header("X-Internal-Key", KEY)
                        .contentType(MediaType.APPLICATION_JSON).content(PAYMENT))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.title").value("Payment received"))
                .andExpect(jsonPath("$.message").value("PNR 1000000016: payment of ₹3440.00 received (Razorpay id pay_1)."));
    }

    @Test
    void missingDataFieldsAreRejected() throws Exception {
        mvc.perform(post("/api/notifications").header("X-Internal-Key", KEY).contentType(MediaType.APPLICATION_JSON)
                        .content(PAYMENT.replace("\"amount\":3440.0,", "")))
                .andExpect(status().isBadRequest())
                // the real server puts this reason in the body's "message" (server.error.include-message)
                .andExpect(status().reason("Missing fields inside 'data' for PAYMENT_CONFIRMED: [amount]"));
    }

    @Test
    void usersSeeOnlyTheirOwnNotifications() throws Exception {
        mvc.perform(post("/api/notifications").header("X-Internal-Key", KEY)
                .contentType(MediaType.APPLICATION_JSON).content(PAYMENT)).andExpect(status().isAccepted());

        mvc.perform(get("/api/notifications/user/7").header("Authorization", bearer("7", "CUSTOMER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].read").value(false));
        mvc.perform(get("/api/notifications/user/7/unread-count").header("Authorization", bearer("7", "CUSTOMER")))
                .andExpect(jsonPath("$.unread").value(1));
        mvc.perform(get("/api/notifications/user/7").header("Authorization", bearer("8", "CUSTOMER")))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/notifications/user/7"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/notifications/user/7").header("Authorization", bearer("2", "STAFF")))
                .andExpect(status().isOk());
    }

    @Test
    void markingAsRead() throws Exception {
        String id = mvc.perform(post("/api/notifications").header("X-Internal-Key", KEY)
                        .contentType(MediaType.APPLICATION_JSON).content(PAYMENT))
                .andReturn().getResponse().getContentAsString().replaceAll(".*\"id\":\"([^\"]+)\".*", "$1");
        mvc.perform(patch("/api/notifications/" + id + "/read").header("Authorization", bearer("8", "CUSTOMER")))
                .andExpect(status().isNotFound());
        mvc.perform(patch("/api/notifications/" + id + "/read").header("Authorization", bearer("7", "CUSTOMER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.read").value(true));

        mvc.perform(post("/api/notifications").header("X-Internal-Key", KEY)
                .contentType(MediaType.APPLICATION_JSON).content(PAYMENT));
        mvc.perform(patch("/api/notifications/user/7/read-all").header("Authorization", bearer("7", "CUSTOMER")))
                .andExpect(jsonPath("$.updated").value(1));
    }

    @Test
    void typesArePublic_logIsForStaff() throws Exception {
        mvc.perform(get("/api/notifications/types"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(7)));
        mvc.perform(get("/api/notifications/log").header("Authorization", bearer("7", "CUSTOMER")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/notifications/log").header("Authorization", bearer("3", "ADMIN")))
                .andExpect(status().isOk());
    }

    @Test
    void demoJourneyForYourself() throws Exception {
        mvc.perform(post("/api/demo/journey?userId=7").header("Authorization", bearer("8", "CUSTOMER")))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/demo/reset").header("Authorization", bearer("7", "CUSTOMER")))
                .andExpect(status().isForbidden());
    }

    @Test
    void badTokensAreRefusedLikeTeam1() throws Exception {
        mvc.perform(get("/api/notifications/user/7").header("Authorization", "Bearer not-a-token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("INVALID_TOKEN"));
    }
}
