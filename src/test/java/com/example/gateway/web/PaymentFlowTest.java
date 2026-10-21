package com.example.gateway.web;

import com.jayway.jsonpath.JsonPath;
import org.json.JSONObject;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Paying for a C3 booking: order, checkout verification, webhook, and payments that can't confirm. */
class PaymentFlowTest extends PaymentApiTestBase {

    private ResultActions order(String email, String pnr) throws Exception {
        return mvc.perform(post("/api/payments/order").header("Authorization", bearer(email))
                .contentType(MediaType.APPLICATION_JSON).content("{\"pnr\": \"" + pnr + "\"}"));
    }

    private String orderId(String email, String pnr) throws Exception {
        return JsonPath.read(order(email, pnr).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(), "$.orderId");
    }

    private ResultActions verifyPayment(String orderId, String paymentId) throws Exception {
        String body = new JSONObject().put("razorpayOrderId", orderId).put("razorpayPaymentId", paymentId)
                .put("razorpaySignature", checkoutSignature(orderId, paymentId)).toString();
        return mvc.perform(post("/api/payments/verify").header("Authorization", bearer(CUSTOMER))
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions webhookCaptured(String eventId, String orderId, String paymentId) throws Exception {
        String payload = new JSONObject().put("id", eventId).put("event", "payment.captured")
                .put("payload", new JSONObject().put("payment", new JSONObject().put("entity",
                        new JSONObject().put("id", paymentId).put("order_id", orderId)))).toString();
        return mvc.perform(post("/api/payments/webhook").header("X-Razorpay-Signature", webhookSignature(payload))
                .contentType(MediaType.APPLICATION_JSON).content(payload));
    }

    private String paymentStatus(String orderId) {
        return dbValue("SELECT status FROM payments WHERE razorpay_order_id = ?", String.class, orderId);
    }

    // ------------------------------------------------------------------ order

    @Test
    void orderIsForTheBookingsAmount() throws Exception {
        String pnr = book(CUSTOMER, 2, 6);
        long paise = totalFare(pnr).movePointRight(2).longValueExact();

        order(CUSTOMER, pnr)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pnr").value(pnr))
                .andExpect(jsonPath("$.amountInPaise").value(paise))
                .andExpect(jsonPath("$.keyId").value("rzp_test_dummy"));
        verify(razorpay.orders).create(argThat(req -> req.getLong("amount") == paise
                && req.getJSONObject("notes").getString("pnr").equals(pnr)));
    }

    @Test
    void doubleClickReusesTheOpenOrder() throws Exception {
        String pnr = book(CUSTOMER, 1, 6);
        assertThat(orderId(CUSTOMER, pnr)).isEqualTo(orderId(CUSTOMER, pnr));
        verify(razorpay.orders, times(1)).create(any());
    }

    @Test
    void onlyTheOwnerCanPay() throws Exception {
        String pnr = book(CUSTOMER, 1, 6);
        order("staff@example.com", pnr).andExpect(status().isForbidden());
        order("admin@example.com", pnr).andExpect(status().isForbidden());
        mvc.perform(post("/api/payments/order").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pnr\": \"" + pnr + "\"}"))
                .andExpect(status().isUnauthorized());
        order(CUSTOMER, "0000000000").andExpect(status().isNotFound());
    }

    @Test
    void expiredHoldsCannotBePaid() throws Exception {
        String pnr = book(CUSTOMER, 1, 6);
        jdbc.update("UPDATE booking SET hold_expires_at = now() - interval '1 minute' WHERE pnr = ?", pnr);
        order(CUSTOMER, pnr).andExpect(status().isConflict());
        verify(razorpay.orders, never()).create(any());
    }

    // ------------------------------------------------------------------ verify and webhook

    @Test
    void verifiedPaymentConfirmsTheBooking() throws Exception {
        String pnr = book(CUSTOMER, 2, 6);
        String orderId = orderId(CUSTOMER, pnr);

        verifyPayment(orderId, "pay_ok1")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PAID"))
                .andExpect(jsonPath("$.pnr").value(pnr));
        assertThat(bookingStatus(pnr)).isEqualTo("CONFIRMED");

        // Razorpay's webhook for the same payment arrives later: nothing changes
        webhookCaptured("evt_1", orderId, "pay_ok1").andExpect(status().isOk());
        assertThat(paymentStatus(orderId)).isEqualTo("PAID");
        verify(razorpay.payments, never()).refund(anyString(), any());
    }

    @Test
    void webhookAloneConfirmsTheBookingWhenTheTabWasClosed() throws Exception {
        String pnr = book(CUSTOMER, 1, 6);
        String orderId = orderId(CUSTOMER, pnr);
        webhookCaptured("evt_2", orderId, "pay_tab").andExpect(status().isOk());
        assertThat(bookingStatus(pnr)).isEqualTo("CONFIRMED");
        assertThat(paymentStatus(orderId)).isEqualTo("PAID");
    }

    @Test
    void forgedSignaturesAreRejected() throws Exception {
        String pnr = book(CUSTOMER, 1, 6);
        String orderId = orderId(CUSTOMER, pnr);
        String body = new JSONObject().put("razorpayOrderId", orderId).put("razorpayPaymentId", "pay_x")
                .put("razorpaySignature", "0".repeat(64)).toString();
        mvc.perform(post("/api/payments/verify").header("Authorization", bearer(CUSTOMER))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
        assertThat(bookingStatus(pnr)).isEqualTo("HELD");
    }

    @Test
    void paymentAfterTheHoldExpiredIsRefundedInFull() throws Exception {
        String pnr = book(CUSTOMER, 1, 6);
        String orderId = orderId(CUSTOMER, pnr);
        BigDecimal paid = totalFare(pnr);
        jdbc.update("UPDATE booking SET hold_expires_at = now() - interval '1 minute' WHERE pnr = ?", pnr);

        verifyPayment(orderId, "pay_late").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REFUNDED"));

        assertThat(bookingStatus(pnr)).isEqualTo("HELD");   // not confirmed; expire_holds will expire it
        verify(razorpay.payments).refund(eq("pay_late"), argThat(req -> req.getLong("amount") == paid.movePointRight(2).longValueExact()));
        assertThat(jdbc.queryForObject("SELECT refund_percent FROM refunds WHERE pnr = ?", BigDecimal.class, pnr))
                .isEqualByComparingTo("100");
    }

    @Test
    void paymentForAnOutdatedAmountIsRefunded() throws Exception {
        String pnr = book(CUSTOMER, 2, 6);
        String orderId = orderId(CUSTOMER, pnr);
        // a passenger is dropped after the order was created, so the price changes
        jdbc.queryForList("SELECT * FROM cancel_passengers(?, ARRAY[?])", pnr, passengerId(pnr, 2));

        verifyPayment(orderId, "pay_old").andExpect(jsonPath("$.status").value("REFUNDED"));
        assertThat(bookingStatus(pnr)).isEqualTo("HELD");

        // a new order is for the new amount
        String second = orderId(CUSTOMER, pnr);
        assertThat(second).isNotEqualTo(orderId);
        verifyPayment(second, "pay_new").andExpect(jsonPath("$.status").value("PAID"));
        assertThat(bookingStatus(pnr)).isEqualTo("CONFIRMED");
    }

    @Test
    void aSecondPaymentForAPaidBookingIsRefunded() throws Exception {
        String pnr = book(CUSTOMER, 1, 6);
        String first = orderId(CUSTOMER, pnr);
        // two orders for the same booking, e.g. from two browser tabs
        jdbc.update("UPDATE payments SET status = 'CREATED' WHERE razorpay_order_id = ?", first);
        String second = "order_tab2";
        jdbc.update("""
                INSERT INTO payments (pnr, user_id, razorpay_order_id, amount, currency, status, version)
                SELECT pnr, user_id, ?, amount, currency, 'CREATED', 0 FROM payments WHERE razorpay_order_id = ?""",
                second, first);

        verifyPayment(first, "pay_a").andExpect(jsonPath("$.status").value("PAID"));
        verifyPayment(second, "pay_b").andExpect(jsonPath("$.status").value("REFUNDED"));
        assertThat(bookingStatus(pnr)).isEqualTo("CONFIRMED");
        verify(razorpay.payments, times(1)).refund(eq("pay_b"), any());
    }

    @Test
    void customersSeeOnlyTheirOwnPayments() throws Exception {
        String pnr = book(CUSTOMER, 1, 6);
        orderId(CUSTOMER, pnr);
        mvc.perform(get("/api/payments/booking/{pnr}", pnr).header("Authorization", bearer(CUSTOMER)))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].pnr").value(pnr));
        mvc.perform(get("/api/payments/booking/{pnr}", pnr).header("Authorization", bearer("staff@example.com")))
                .andExpect(status().isOk());
        mvc.perform(get("/api/payments/my").header("Authorization", bearer("staff@example.com")))
                .andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------------ logins

    @Test
    void theOldDevLoginIsGoneAndOnlyTeam1TokensWork() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\": 1, \"role\": \"ADMIN\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/payments/my").header("Authorization", "Bearer not-a-token"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/payments/my").header("Authorization", bearer("locked@example.com")))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/payments/my").header("Authorization", bearer(CUSTOMER)))
                .andExpect(status().isOk());
    }
}
