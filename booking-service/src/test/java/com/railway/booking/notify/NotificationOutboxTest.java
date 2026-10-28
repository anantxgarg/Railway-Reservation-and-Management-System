package com.railway.booking.notify;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.railway.booking.ApiTestBase;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Team 6 notifications: what booking-service queues itself, and delivering
 * notification_outbox rows to a stand-in for Team 6's notification-service.
 */
class NotificationOutboxTest extends ApiTestBase {

    @Autowired
    private TransactionTemplate tx;

    @Autowired
    private ObjectMapper json;

    private HttpServer team6;
    private final List<String> received = new CopyOnWriteArrayList<>();
    private volatile int replyStatus = 202;

    @BeforeEach
    void startTeam6() throws IOException {
        team6 = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        team6.createContext("/api/notifications", exchange -> {
            String key = exchange.getRequestHeaders().getFirst("X-Internal-Key");
            received.add(key + " " + new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            exchange.sendResponseHeaders(replyStatus, -1);
            exchange.close();
        });
        team6.start();
    }

    @AfterEach
    void stopTeam6() {
        team6.stop(0);
    }

    private NotificationOutboxJob job() {
        return new NotificationOutboxJob(jdbc, tx, json, "http://127.0.0.1:" + team6.getAddress().getPort(), "k3y", 24);
    }

    private String unpaidBooking() {
        return jdbc.queryForObject("""
                SELECT create_booking(?, ?, '3A', 'GN', 1, 4, '[{"name":"Asha Rao","age":34,"gender":"F"}]')""",
                String.class, userId("customer@example.com"), runId("12952", 5));
    }

    @Test
    void cancellingAnUnpaidBookingQueuesBookingCancelled() throws Exception {
        String pnr = unpaidBooking();
        mvc.perform(post("/api/bookings/{pnr}/cancel", pnr).header(HttpHeaders.AUTHORIZATION, bearer("customer@example.com"))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk());
        String data = jdbc.queryForObject(
                "SELECT data::TEXT FROM notification_outbox WHERE pnr = ? AND type = 'BOOKING_CANCELLED'", String.class, pnr);
        assertThat(data).contains("\"trainNumber\": \"12952\"", "\"cancelledPassengers\": 1", "\"refundAmount\": 0",
                "\"reason\": \"Cancelled before payment\"");
    }

    @Test
    void deliversQueuedNotificationsWithTeam6sHandle() {
        String pnr = unpaidBooking();
        jdbc.queryForObject("SELECT queue_notification('PAYMENT_CONFIRMED', ?, 'team-4', "
                + "'{\"razorpayPaymentId\":\"pay_1\",\"razorpayOrderId\":\"order_1\",\"amount\":3440,\"paidAt\":\"2026-10-21T14:29:55\"}')",
                Long.class, pnr);

        assertThat(job().deliverDue()).isEqualTo(1);
        assertThat(received).hasSize(1);
        assertThat(received.get(0))
                .startsWith("k3y ")
                .contains("\"type\":\"PAYMENT_CONFIRMED\"", "\"userId\":\"" + userId("customer@example.com") + "\"",
                        "\"pnr\":\"" + pnr + "\"", "\"sourceTeam\":\"team-4\"", "\"razorpayPaymentId\":\"pay_1\"");
        assertThat(jdbc.queryForObject("SELECT sent_at IS NOT NULL FROM notification_outbox WHERE pnr = ?", Boolean.class, pnr))
                .isTrue();
        // sent once only
        assertThat(job().deliverDue()).isZero();
    }

    @Test
    void aRefusedNotificationIsKeptForLater() {
        String pnr = unpaidBooking();
        jdbc.queryForObject("SELECT queue_notification('BOOKING_CANCELLED', ?, 'team-3', '{}')", Long.class, pnr);
        replyStatus = 400;

        assertThat(job().deliverDue()).isZero();
        var row = jdbc.queryForMap("SELECT attempts, last_error, sent_at FROM notification_outbox WHERE pnr = ?", pnr);
        assertThat(row.get("attempts")).isEqualTo(1);
        assertThat((String) row.get("last_error")).contains("400");
        assertThat(row.get("sent_at")).isNull();
        // not due again straight away (it waits 2 s, then 4 s, ...)
        assertThat(job().deliverDue()).isZero();
        assertThat(received).hasSize(1);
    }
}
