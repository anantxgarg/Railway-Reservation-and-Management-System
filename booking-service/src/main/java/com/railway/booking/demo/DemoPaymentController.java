package com.railway.booking.demo;

import java.math.BigDecimal;

import com.railway.booking.booking.BookingModels.BookingDetail;
import com.railway.booking.booking.BookingRepository;
import com.railway.booking.error.ApiException;
import com.railway.booking.security.AuthUser;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * DEMO MODE ONLY: a stand-in for Team 4's payment. In the real system Team 4
 * takes the money (Razorpay) and then calls confirm_booking(pnr); here the
 * owner presses "pay" and the booking is confirmed straight away, without
 * any money changing hands.
 *
 * POST /api/bookings/{pnr}/demo-pay (no body) returns the confirmed booking,
 * the same JSON as GET /api/bookings/{pnr}.
 */
@RestController
@ConditionalOnProperty(name = "booking.demo.enabled", havingValue = "true")
public class DemoPaymentController {

    private final BookingRepository bookings;
    private final JdbcTemplate jdbc;

    public DemoPaymentController(BookingRepository bookings, JdbcTemplate jdbc) {
        this.bookings = bookings;
        this.jdbc = jdbc;
    }

    /**
     * Only the owner may pay. As with GET /api/bookings/{pnr}, another customer
     * gets 404 so PNRs can't be probed; STAFF/ADMIN, who may see the booking,
     * get 403. An already paid booking is 409 WRONG_STATE; an expired hold or a
     * cancelled booking is refused by confirm_booking (55000, also 409 WRONG_STATE).
     */
    @PostMapping("/api/bookings/{pnr}/demo-pay")
    @Transactional
    public BookingDetail pay(@AuthenticationPrincipal AuthUser user, @PathVariable String pnr) {
        BookingRepository.Ownership booking = bookings.ownership(pnr)
                .orElseThrow(() -> ApiException.notFound("PNR " + pnr + " not found"));
        if (booking.userId() != user.userId()) {
            if (!user.isStaff()) {
                throw ApiException.notFound("PNR " + pnr + " not found");
            }
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only the booking's owner can pay for it");
        }
        if ("CONFIRMED".equals(booking.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "WRONG_STATE", "PNR " + pnr + " is already paid");
        }
        // what Team 4 calls after a successful payment
        jdbc.queryForObject("SELECT confirm_booking(?)", BigDecimal.class, pnr);
        return bookings.detail(pnr).orElseThrow();
    }
}
