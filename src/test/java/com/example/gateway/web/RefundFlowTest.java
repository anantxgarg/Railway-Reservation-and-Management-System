package com.example.gateway.web;

import com.razorpay.RazorpayException;
import org.json.JSONObject;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Cancelling passengers of a paid booking: Team 3's cancel_passengers and the refund in one transaction. */
class RefundFlowTest extends PaymentApiTestBase {

    /** A booking 6 days ahead (90% refund window), paid with Razorpay payment pay_<pnr>. */
    private String paidBooking(int passengers) {
        String pnr = book(CUSTOMER, passengers, 6);
        jdbc.update("""
                INSERT INTO payments (pnr, user_id, razorpay_order_id, razorpay_payment_id, amount, currency, status, version)
                SELECT pnr, user_id, 'order_' || pnr, 'pay_' || pnr, total_fare, 'INR', 'PAID', 0 FROM booking WHERE pnr = ?""",
                pnr);
        jdbc.queryForObject("SELECT confirm_booking(?)", BigDecimal.class, pnr);
        return pnr;
    }

    private ResultActions refund(String email, String pnr, List<Integer> passengerIds) throws Exception {
        JSONObject body = new JSONObject().put("pnr", pnr);
        if (passengerIds != null) {
            body.put("passengerIds", passengerIds);
        }
        return mvc.perform(post("/api/refunds").header("Authorization", bearer(email))
                .contentType(MediaType.APPLICATION_JSON).content(body.toString()));
    }

    private String passengerStatus(int passengerId) {
        return jdbc.queryForObject("SELECT status::TEXT FROM passenger WHERE passenger_id = ?", String.class, passengerId);
    }

    private BigDecimal fare(int passengerId) {
        return jdbc.queryForObject("SELECT passenger_fare FROM passenger WHERE passenger_id = ?", BigDecimal.class, passengerId);
    }

    private static BigDecimal ninetyPercent(BigDecimal amount) {
        return amount.multiply(BigDecimal.valueOf(90)).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
    }

    @Test
    void previewShowsWhatCancellingWouldRefund() throws Exception {
        String pnr = paidBooking(2);
        int p1 = passengerId(pnr, 1);
        mvc.perform(get("/api/refunds/preview/{pnr}", pnr).param("passengerIds", String.valueOf(p1))
                        .header("Authorization", bearer(CUSTOMER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paidAmount").value(fare(p1).doubleValue()))
                .andExpect(jsonPath("$.refundPercent").value(90))
                .andExpect(jsonPath("$.refundAmount").value(ninetyPercent(fare(p1)).doubleValue()));
        assertThat(passengerStatus(p1)).isEqualTo("CONFIRMED");
    }

    @Test
    void cancellingSomePassengersRefundsThemAndKeepsTheRest() throws Exception {
        String pnr = paidBooking(2);
        int p1 = passengerId(pnr, 1);
        BigDecimal expected = ninetyPercent(fare(p1));

        refund(CUSTOMER, pnr, List.of(p1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").value(expected.doubleValue()))
                .andExpect(jsonPath("$.status").value("PROCESSED"));

        assertThat(passengerStatus(p1)).isEqualTo("CANCELLED");
        assertThat(passengerStatus(passengerId(pnr, 2))).isEqualTo("CONFIRMED");
        assertThat(bookingStatus(pnr)).isEqualTo("CONFIRMED");
        assertThat(dbValue("SELECT status FROM payments WHERE pnr = ?", String.class, pnr))
                .isEqualTo("PARTIALLY_REFUNDED");
        verify(razorpay.payments).refund(eq("pay_" + pnr),
                argThat(req -> req.getLong("amount") == expected.movePointRight(2).longValueExact()));
    }

    @Test
    void cancellingEveryoneCancelsTheBookingAndCompletesTheRefund() throws Exception {
        String pnr = paidBooking(2);
        refund(CUSTOMER, pnr, List.of(passengerId(pnr, 1))).andExpect(status().isOk());
        refund("staff@example.com", pnr, null).andExpect(status().isOk());   // staff may cancel too

        assertThat(bookingStatus(pnr)).isEqualTo("CANCELLED");
        assertThat(dbValue("SELECT status FROM payments WHERE pnr = ?", String.class, pnr))
                .isEqualTo("REFUNDED");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM refunds WHERE pnr = ?", Integer.class, pnr)).isEqualTo(2);

        refund(CUSTOMER, pnr, null).andExpect(status().isConflict());
    }

    @Test
    void unpaidBookingsAreNotRefundedHere() throws Exception {
        String pnr = book(CUSTOMER, 1, 6);
        refund(CUSTOMER, pnr, null).andExpect(status().isConflict());
        assertThat(bookingStatus(pnr)).isEqualTo("HELD");
    }

    @Test
    void otherCustomersCannotCancelOrSeeRefunds() throws Exception {
        String pnr = paidBooking(1);
        jdbc.update("""
                INSERT INTO users (role_id, name, email, password_hash)
                SELECT role_id, 'Other', 'other@example.com', (SELECT password_hash FROM users WHERE user_id = 1)
                FROM roles WHERE role_name = 'CUSTOMER'""");
        refund("other@example.com", pnr, null).andExpect(status().isNotFound());
        mvc.perform(get("/api/refunds/booking/{pnr}", pnr).header("Authorization", bearer("other@example.com")))
                .andExpect(status().isNotFound());
        assertThat(bookingStatus(pnr)).isEqualTo("CONFIRMED");
    }

    @Test
    void passengersOfAnotherBookingAreRejected() throws Exception {
        String pnr = paidBooking(1);
        String other = book(CUSTOMER, 1, 6);
        refund(CUSTOMER, pnr, List.of(passengerId(other, 1)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.containsString("is not an active passenger")));
    }

    /**
     * Not in a test transaction: the service's own transaction must roll the
     * cancellation back when Razorpay refuses the refund.
     */
    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void whenRazorpayRefusesTheRefundNobodyIsCancelled() throws Exception {
        String pnr = paidBooking(1);
        int p1 = passengerId(pnr, 1);
        when(razorpay.payments.refund(anyString(), any())).thenThrow(new RazorpayException("refund declined"));
        try {
            refund(CUSTOMER, pnr, null).andExpect(status().isBadGateway());
            assertThat(passengerStatus(p1)).isEqualTo("CONFIRMED");
            assertThat(bookingStatus(pnr)).isEqualTo("CONFIRMED");
            assertThat(jdbc.queryForObject("SELECT count(*) FROM refunds WHERE pnr = ?", Integer.class, pnr)).isZero();
        } finally {
            // this test commits, so tidy up what it made
            jdbc.update("DELETE FROM refunds WHERE pnr = ?", pnr);
            jdbc.update("DELETE FROM payments WHERE pnr = ?", pnr);
            if (List.of("HELD", "CONFIRMED").contains(bookingStatus(pnr))) {
                jdbc.queryForList("SELECT * FROM cancel_passengers(?)", pnr);
            }
        }
    }

    @Test
    void cancellingInsideTheLastWindowIsAllowedAndRefundsNothing() throws Exception {
        String pnr = book(CUSTOMER, 1, 0);   // leaves today: less than 4h by the policy's clock
        jdbc.update("""
                INSERT INTO payments (pnr, user_id, razorpay_order_id, razorpay_payment_id, amount, currency, status, version)
                SELECT pnr, user_id, 'order_' || pnr, 'pay_' || pnr, total_fare, 'INR', 'PAID', 0 FROM booking WHERE pnr = ?""",
                pnr);
        jdbc.queryForObject("SELECT confirm_booking(?)", BigDecimal.class, pnr);

        refund(CUSTOMER, pnr, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").value(0))
                .andExpect(jsonPath("$.razorpayRefundId").doesNotExist());
        assertThat(bookingStatus(pnr)).isEqualTo("CANCELLED");
        verify(razorpay.payments, never()).refund(anyString(), any());
    }
}
