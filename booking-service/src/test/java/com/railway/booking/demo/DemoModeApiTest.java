package com.railway.booking.demo;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.StringJoiner;

import com.jayway.jsonpath.JsonPath;
import com.railway.booking.ApiTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Demo mode (booking.demo.enabled=true): the stand-ins for Team 1's login and
 * Team 4's payment, and cancelling paid bookings. Every token here comes from
 * the demo login, not from ApiTestBase.
 */
@TestPropertySource(properties = "booking.demo.enabled=true")
class DemoModeApiTest extends ApiTestBase {

    private static final String CUSTOMER = "customer@example.com";
    private static final String PASSWORD = "Railway@Dev123";

    // ------------------------------------------------------------------ helpers

    private ResultActions login(String email, String password) throws Exception {
        return mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\": \"%s\", \"password\": \"%s\"}".formatted(email, password)));
    }

    /** Logs in and returns the response body. */
    private String session(String email) throws Exception {
        return login(email, PASSWORD).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }

    private String demoBearer(String email) throws Exception {
        return "Bearer " + JsonPath.read(session(email), "$.token");
    }

    private ResultActions refresh(String refreshToken) throws Exception {
        return mvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\": \"%s\"}".formatted(refreshToken)));
    }

    private String book(String bearer, int runId, String classCode, String from, String to, int count)
            throws Exception {
        StringJoiner passengers = new StringJoiner(",", "[", "]");
        for (int i = 1; i <= count; i++) {
            passengers.add("{\"name\":\"Passenger " + i + "\",\"age\":30,\"gender\":\"M\"}");
        }
        String body = mvc.perform(post("/api/bookings").header(HttpHeaders.AUTHORIZATION, bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"runId": %d, "classCode": "%s", "from": "%s", "to": "%s", "passengers": %s}"""
                                .formatted(runId, classCode, from, to, passengers)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.pnr");
    }

    private ResultActions pay(String bearer, String pnr) throws Exception {
        return mvc.perform(post("/api/bookings/{pnr}/demo-pay", pnr).header(HttpHeaders.AUTHORIZATION, bearer));
    }

    private ResultActions cancel(String bearer, String pnr, String body) throws Exception {
        var req = post("/api/bookings/{pnr}/cancel", pnr).header(HttpHeaders.AUTHORIZATION, bearer);
        if (body != null) {
            req.contentType(MediaType.APPLICATION_JSON).content(body);
        }
        return mvc.perform(req);
    }

    private ResultActions getBooking(String bearer, String pnr) throws Exception {
        return mvc.perform(get("/api/bookings/{pnr}", pnr).header(HttpHeaders.AUTHORIZATION, bearer));
    }

    private int passengerId(String pnr, int passengerNo) {
        return jdbc.queryForObject("SELECT passenger_id FROM v_pnr_status WHERE pnr = ? AND passenger_no = ?",
                Integer.class, pnr, passengerNo);
    }

    // ------------------------------------------------------------------ login (Team 1 stand-in)

    @Test
    void loginReturnsTeam1sResponseAndTheTokenWorks() throws Exception {
        String body = login("  Customer@Example.com ", PASSWORD)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Login successful"))
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").value(matchesPattern("[0-9a-f]{128}")))
                .andExpect(jsonPath("$.user.userId").value(userId(CUSTOMER)))
                .andExpect(jsonPath("$.user.name").value("Test Customer"))
                .andExpect(jsonPath("$.user.email").value(CUSTOMER))
                .andExpect(jsonPath("$.user.role").value("CUSTOMER"))
                .andExpect(jsonPath("$.user.password_hash").doesNotExist())
                .andReturn().getResponse().getContentAsString();

        String bearer = "Bearer " + JsonPath.read(body, "$.token");
        mvc.perform(get("/api/bookings/mine").header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(CUSTOMER))
                .andExpect(jsonPath("$.role").value("CUSTOMER"))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.lastLoginAt").isNotEmpty());
    }

    @Test
    void staffAndAdminGetTheirRole() throws Exception {
        login("staff@example.com", PASSWORD).andExpect(jsonPath("$.user.role").value("STAFF"));
        login("admin@example.com", PASSWORD).andExpect(jsonPath("$.user.role").value("ADMIN"));
    }

    @Test
    void wrongPasswordAndUnknownEmailGetTheSameAnswer() throws Exception {
        for (String[] attempt : new String[][] {{CUSTOMER, "Wrong@Pass123"}, {"nobody@example.com", PASSWORD}}) {
            login(attempt[0], attempt[1])
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.error.code").value("INVALID_CREDENTIALS"))
                    .andExpect(jsonPath("$.error.message").value("Invalid email or password"))
                    .andExpect(jsonPath("$.token").doesNotExist());
        }
    }

    @Test
    void lockedAndSuspendedAccountsCannotLogIn() throws Exception {
        login("locked@example.com", PASSWORD)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("ACCOUNT_NOT_ACTIVE"))
                .andExpect(jsonPath("$.error.message").value(containsString("locked")));
        login("suspended@example.com", PASSWORD)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("ACCOUNT_NOT_ACTIVE"));
        // a wrong password on a locked account says nothing about the account
        login("locked@example.com", "Wrong@Pass123").andExpect(status().isUnauthorized());
    }

    @Test
    void malformedLoginIsAValidationError() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"email\": \"x\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.message").value("Request validation failed"))
                .andExpect(jsonPath("$.error.fields[*].field").value(org.hamcrest.Matchers.contains("email", "password")));
    }

    @Test
    void refreshRotatesTheRefreshToken() throws Exception {
        String first = JsonPath.read(session(CUSTOMER), "$.refreshToken");
        String body = refresh(first)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").value(not(first)))
                .andReturn().getResponse().getContentAsString();
        mvc.perform(get("/api/bookings/mine")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + JsonPath.read(body, "$.token")))
                .andExpect(status().isOk());

        // each refresh token works once
        refresh(first)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("INVALID_REFRESH_TOKEN"));
        refresh("not-a-refresh-token").andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields[0].field").value("refreshToken"));
    }

    @Test
    void logoutEndsTheSession() throws Exception {
        String body = session(CUSTOMER);
        String refreshToken = JsonPath.read(body, "$.refreshToken");
        mvc.perform(post("/api/auth/logout").header(HttpHeaders.AUTHORIZATION, "Bearer " + JsonPath.read(body, "$.token")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Logged out successfully"));
        refresh(refreshToken).andExpect(status().isUnauthorized());

        mvc.perform(post("/api/auth/logout"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("MISSING_TOKEN"));
    }

    // ------------------------------------------------------------------ demo-pay (Team 4 stand-in)

    @Test
    void demoPayConfirmsAHeldBooking() throws Exception {
        String bearer = demoBearer(CUSTOMER);
        String pnr = book(bearer, runId("12127", 6), "2S", "CSMT", "PUNE", 2);

        pay(bearer, pnr)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pnr").value(pnr))
                .andExpect(jsonPath("$.status").value("CONFIRMED"))
                .andExpect(jsonPath("$.holdExpiresAt").value(nullValue()))
                .andExpect(jsonPath("$.passengers", hasSize(2)))
                .andExpect(jsonPath("$.totalFare").value(greaterThan(0.0)));
        getBooking(bearer, pnr).andExpect(jsonPath("$.status").value("CONFIRMED"));

        pay(bearer, pnr)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("WRONG_STATE"));
    }

    @Test
    void onlyTheOwnerCanPay() throws Exception {
        String pnr = book(demoBearer(CUSTOMER), runId("12127", 6), "2S", "CSMT", "PUNE", 1);
        String other = otherCustomer(); // same password as the dev customer
        pay(demoBearer(other), pnr).andExpect(status().isNotFound());
        pay(demoBearer("staff@example.com"), pnr)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
        pay(demoBearer(CUSTOMER), "0000000000").andExpect(status().isNotFound());
        getBooking(demoBearer(CUSTOMER), pnr).andExpect(jsonPath("$.status").value("HELD"));
    }

    @Test
    void demoPayRefusesAnExpiredHold() throws Exception {
        String bearer = demoBearer(CUSTOMER);
        String pnr = book(bearer, runId("12127", 6), "2S", "CSMT", "PUNE", 1);
        jdbc.update("UPDATE booking SET hold_expires_at = now() - interval '1 minute' WHERE pnr = ?", pnr);
        // confirm_booking raises 55000; this aborts the test transaction, so it is the last call
        pay(bearer, pnr)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("WRONG_STATE"))
                .andExpect(jsonPath("$.error.message").value(containsString("hold expired")));
    }

    @Test
    void demoPayRefusesACancelledBooking() throws Exception {
        String bearer = demoBearer(CUSTOMER);
        String pnr = book(bearer, runId("12127", 6), "2S", "CSMT", "PUNE", 1);
        cancel(bearer, pnr, null).andExpect(status().isOk());
        pay(bearer, pnr)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("WRONG_STATE"))
                .andExpect(jsonPath("$.error.message").value(containsString("CANCELLED")));
    }

    // ------------------------------------------------------------------ cancel after payment

    @Test
    void ownerCanCancelAPaidBookingAndTheWaitlistMovesUp() throws Exception {
        String bearer = demoBearer(CUSTOMER);
        int run = runId("12952", 7); // 1A: 18 berths, no RAC
        String paid = book(bearer, run, "1A", "NDLS", "BCT", 6);
        book(bearer, run, "1A", "NDLS", "BCT", 6);
        book(bearer, run, "1A", "NDLS", "BCT", 6);
        String waiting = book(bearer, run, "1A", "NDLS", "BCT", 1);
        pay(bearer, paid).andExpect(status().isOk());

        cancel(bearer, paid, "{\"passengerIds\": [%d]}".formatted(passengerId(paid, 1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bookingWasPaid").value(true))
                .andExpect(jsonPath("$.cancelledFare").value(greaterThan(0.0)))
                .andExpect(jsonPath("$.cancelled[0].previousStatus").value("CONFIRMED"))
                .andExpect(jsonPath("$.booking.status").value("CONFIRMED"))
                .andExpect(jsonPath("$.booking.passengers[0].label").value("CAN"));

        getBooking(bearer, waiting)
                .andExpect(jsonPath("$.passengers[0].status").value("CONFIRMED"))
                .andExpect(jsonPath("$.passengers[0].label").value(startsWith("CNF/H1/")));

        // the rest of the paid booking; staff still can't cancel paid bookings, even in demo mode
        cancel(demoBearer("staff@example.com"), paid, null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("PAID_BOOKING"));
        cancel(bearer, paid, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cancelled", hasSize(5)))
                .andExpect(jsonPath("$.booking.status").value("CANCELLED"));
    }
}
