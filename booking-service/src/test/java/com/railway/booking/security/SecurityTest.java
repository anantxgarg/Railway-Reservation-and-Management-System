package com.railway.booking.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.railway.booking.ApiTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

/** Who can reach which endpoint. */
class SecurityTest extends ApiTestBase {

    @Test
    void publicEndpointsNeedNoToken() throws Exception {
        mvc.perform(get("/api/search").param("from", "NDLS").param("to", "KOTA").param("date", "2030-01-01"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/runs/{id}/availability", runId("12952", 3))).andExpect(status().isOk());
    }

    @Test
    void bookingEndpointsNeedAToken() throws Exception {
        mvc.perform(get("/api/bookings/mine"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("MISSING_TOKEN"));
        mvc.perform(post("/api/bookings").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void badTokenIsRefusedEvenOnPublicEndpoints() throws Exception {
        mvc.perform(get("/api/search").param("from", "NDLS").param("to", "KOTA").param("date", "2030-01-01")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer not-a-token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("INVALID_TOKEN"));
        mvc.perform(get("/api/bookings/mine").header(HttpHeaders.AUTHORIZATION, "Basic abc"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("INVALID_TOKEN"));
    }

    @Test
    void expiredTokenIsReported() throws Exception {
        String expired = token(String.valueOf(userId("customer@example.com")), secret(), -60);
        mvc.perform(get("/api/bookings/mine").header(HttpHeaders.AUTHORIZATION, "Bearer " + expired))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("TOKEN_EXPIRED"));
    }

    @Test
    void lockedSuspendedOrUnknownAccountsAreRefused() throws Exception {
        for (String email : new String[] {"locked@example.com", "suspended@example.com"}) {
            mvc.perform(get("/api/bookings/mine").header(HttpHeaders.AUTHORIZATION, bearer(email)))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.error.code").value("ACCOUNT_NOT_ACTIVE"));
        }
        mvc.perform(get("/api/bookings/mine").header(HttpHeaders.AUTHORIZATION, "Bearer " + token("99999", secret(), 60)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("USER_NOT_FOUND"));
    }

    @Test
    void roleComesFromTheDatabaseNotTheToken() throws Exception {
        // the token says CUSTOMER (see ApiTestBase.token), the database says STAFF
        mvc.perform(post("/api/bookings").header(HttpHeaders.AUTHORIZATION, bearer("staff@example.com"))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
    }

    @Test
    void onlyCustomersCanBook() throws Exception {
        mvc.perform(post("/api/bookings").header(HttpHeaders.AUTHORIZATION, bearer("admin@example.com"))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
    }
}
