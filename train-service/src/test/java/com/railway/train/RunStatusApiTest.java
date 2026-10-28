package com.railway.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

/** Run status, delays, generated runs, and live status. */
class RunStatusApiTest extends ApiTestBase {

    private static final LocalDate IN_5_DAYS = LocalDate.now().plusDays(5);

    @Test
    void staffSetStatusAndDelay_customersCannot() throws Exception {
        int run = runId("12952", IN_5_DAYS);
        String body = "{\"status\":\"DELAYED\",\"delayMinutes\":25}";
        mvc.perform(patch("/api/schedules/runs/" + run + "/status").header("Authorization", bearer("customer@example.com"))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/schedules/runs/" + run + "/status").header("Authorization", bearer("staff@example.com"))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.run.status").value("DELAYED"))
                .andExpect(jsonPath("$.run.delayMinutes").value(25))
                .andExpect(jsonPath("$.journeyCompletedNotifications").value(0));
        mvc.perform(patch("/api/schedules/runs/" + run + "/status").header("Authorization", bearer("staff@example.com"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"LATE\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void arrivedQueuesJourneyCompletedForPaidBookings() throws Exception {
        int run = runId("12952", IN_5_DAYS);
        String pnr = paidBooking(run, "3A");
        mvc.perform(patch("/api/schedules/runs/" + run + "/status").header("Authorization", bearer("staff@example.com"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"ARRIVED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.journeyCompletedNotifications").value(1));
        String data = jdbc.queryForObject(
                "SELECT data::TEXT FROM notification_outbox WHERE pnr = ? AND type = 'JOURNEY_COMPLETED'", String.class, pnr);
        assertThat(data).contains("\"passengerName\": \"Asha Rao\"", "\"departureTime\": \"16:55\"",
                "\"arrivalTime\": \"08:25\"", "\"toStation\": \"BCT\"");
    }

    @Test
    void liveStatusOfAFutureRunShowsTheTimetablePlusDelay() throws Exception {
        int run = runId("16535", jdbc.queryForObject(
                "SELECT min(run_date) FROM train_run WHERE train_no = '16535' AND run_date > CURRENT_DATE", LocalDate.class));
        jdbc.update("UPDATE train_run SET status = 'DELAYED', delay_minutes = 15 WHERE run_id = ?", run);
        mvc.perform(get("/api/live-status/run/" + run))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary").value("Running 15 min late"))
                .andExpect(jsonPath("$.stops[0].stationCode").value("PUNE"))
                .andExpect(jsonPath("$.stops[0].status").value("NEXT"))
                .andExpect(jsonPath("$.stops[1].status").value("EXPECTED"))
                .andExpect(jsonPath("$.stops[1].scheduledArrival").value(org.hamcrest.Matchers.endsWith("T14:30:00+05:30")))
                .andExpect(jsonPath("$.stops[1].expectedArrival").value(org.hamcrest.Matchers.endsWith("T14:45:00+05:30")))
                .andExpect(jsonPath("$.stops[3].scheduledDeparture").doesNotExist());
    }

    @Test
    void liveStatusOfARunThatIsOver() throws Exception {
        jdbc.update("INSERT INTO train_run (train_no, run_date) VALUES ('12127', CURRENT_DATE - 2)");
        int run = runId("12127", LocalDate.now().minusDays(2));
        mvc.perform(get("/api/live-status/run/" + run))
                .andExpect(jsonPath("$.stops[0].status").value("DEPARTED"))
                .andExpect(jsonPath("$.stops[1].status").value("ARRIVED"));
        jdbc.update("UPDATE train_run SET status = 'CANCELLED' WHERE run_id = ?", run);
        mvc.perform(get("/api/live-status/run/" + run))
                .andExpect(jsonPath("$.summary").value("Cancelled"))
                .andExpect(jsonPath("$.stops[1].status").value("CANCELLED"));
    }

    @Test
    void liveStatusByPnr_ownerAndStaffOnly() throws Exception {
        int run = runId("12952", IN_5_DAYS);
        String pnr = paidBooking(run, "3A");
        mvc.perform(get("/api/live-status/pnr/" + pnr)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/live-status/pnr/" + pnr).header("Authorization", bearer("customer@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pnr").value(pnr))
                .andExpect(jsonPath("$.trainNo").value("12952"))
                .andExpect(jsonPath("$.boardingSeq").value(1))
                .andExpect(jsonPath("$.destinationSeq").value(4));
        mvc.perform(get("/api/live-status/pnr/" + pnr).header("Authorization", bearer("staff@example.com")))
                .andExpect(status().isOk());
        jdbc.update("""
                INSERT INTO users (role_id, name, email, password_hash)
                SELECT role_id, 'Other', 'other@example.com',
                       (SELECT password_hash FROM users WHERE email = 'customer@example.com')
                FROM roles WHERE role_name = 'CUSTOMER'""");
        mvc.perform(get("/api/live-status/pnr/" + pnr).header("Authorization", bearer("other@example.com")))
                .andExpect(status().isNotFound());
    }

    @Test
    void adminsGenerateMissingRuns() throws Exception {
        jdbc.update("DELETE FROM train_run WHERE train_no = '12128' AND run_date = ?", IN_5_DAYS);
        mvc.perform(post("/api/schedules/runs/generate?days=30").header("Authorization", bearer("admin@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.created").value(1));
        mvc.perform(post("/api/schedules/runs/generate?days=500").header("Authorization", bearer("admin@example.com")))
                .andExpect(status().isUnprocessableEntity());
    }
}
