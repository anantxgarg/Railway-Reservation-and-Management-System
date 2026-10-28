package com.example.gateway.service;

import com.example.gateway.domain.*;
import com.example.gateway.repo.PaymentRepository;
import com.example.gateway.repo.RefundRepository;
import com.example.gateway.repo.ReservationRepository;
import com.example.gateway.repo.ReservationRepository.CancelledPassenger;
import com.example.gateway.repo.ReservationRepository.PassengerInfo;
import com.example.gateway.repo.ReservationRepository.Reservation;
import com.example.gateway.web.ApiException;
import com.example.gateway.web.Dtos.RefundQuote;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;

/**
 * Refund = cancellation of passengers on a paid booking. Calculated on what was
 * paid for the cancelled passengers, by how long before departure they cancel.
 *
 * The passengers are cancelled with Team 3's cancel_passengers() in the same
 * transaction that records the refund: if Razorpay refuses the refund, the
 * cancellation is rolled back too, so seats are never released without a refund.
 * Unpaid bookings are cancelled through the booking service instead.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RefundService {

    /**
     * Departure is when the train leaves the passenger's boarding station, from
     * Team 2's timetable (route departure time + stop offset, in India time).
     * Should a run have no timetable, the start of the travel day in India is
     * used, which never gives more than the policy allows.
     */
    static final ZoneId RAILWAY_ZONE = ZoneId.of("Asia/Kolkata");

    private final RazorpayClient client;
    private final ReservationRepository reservations;
    private final PaymentRepository payments;
    private final RefundRepository refunds;

    @Value("${refund.full-window-hours}")
    private long fullWindowHours;
    @Value("${refund.full-window-percent}")
    private BigDecimal fullWindowPercent;
    @Value("${refund.mid-window-hours}")
    private long midWindowHours;
    @Value("${refund.mid-window-percent}")
    private BigDecimal midWindowPercent;
    @Value("${refund.late-window-hours}")
    private long lateWindowHours;
    @Value("${refund.late-window-percent}")
    private BigDecimal lateWindowPercent;

    /** The refund percentage and its explanation for a given time before departure. */
    record Policy(BigDecimal percent, String note) {
    }

    /** Shows what cancelling these passengers (null = everyone left) would refund, without doing it. */
    public RefundQuote quote(String pnr, List<Integer> passengerIds, Integer userId, boolean isStaffOrAdmin) {
        Reservation booking = ownedBooking(pnr, userId, isStaffOrAdmin);
        requireConfirmed(booking);
        getPaidPayment(pnr);

        List<PassengerInfo> chosen = reservations.activePassengers(pnr).stream()
                .filter(p -> passengerIds == null || passengerIds.contains(p.passengerId()))
                .toList();
        if (passengerIds != null && chosen.size() != passengerIds.size()) {
            throw ApiException.badRequest("Some passengers are not active passengers of PNR " + pnr);
        }
        BigDecimal paid = chosen.stream().map(PassengerInfo::fare).reduce(BigDecimal.ZERO, BigDecimal::add);
        return buildQuote(pnr, paid, policyFor(departure(booking), Instant.now()));
    }

    /**
     * Cancels the passengers (null = everyone left) and refunds them by the policy.
     * Cancelling inside the last window is allowed and refunds nothing.
     */
    @Transactional
    public Refund requestRefund(String pnr, List<Integer> passengerIds, String reason,
                                Integer userId, boolean isStaffOrAdmin) {
        ownedBooking(pnr, userId, isStaffOrAdmin);
        Reservation booking = reservations.lock(pnr).orElseThrow();
        requireConfirmed(booking);
        Payment payment = getPaidPayment(pnr);

        // cancel first: it validates the passenger ids and returns what each one paid
        List<CancelledPassenger> cancelled = reservations.cancel(pnr, passengerIds);
        BigDecimal paid = cancelled.stream().map(CancelledPassenger::fare).reduce(BigDecimal.ZERO, BigDecimal::add);
        RefundQuote quote = buildQuote(pnr, paid, policyFor(departure(booking), Instant.now()));

        Refund r = new Refund();
        r.setPnr(pnr);
        r.setPaymentId(payment.getId());
        r.setUserId(payment.getUserId());
        r.setProcessedByStaffId(isStaffOrAdmin ? userId : null);
        r.setAmount(quote.refundAmount());
        r.setRefundPercent(quote.refundPercent());
        r.setReason(reason != null ? reason : "Passenger cancellation (" + cancelled.size() + " passenger(s))");
        if (quote.refundAmount().signum() > 0) {
            issue(r, payment, reason == null ? "Passenger cancellation" : reason, userId, isStaffOrAdmin);
        } else {
            r.setStatus(RefundStatus.PROCESSED);   // nothing to send back: quote.note() says why
        }
        refunds.save(r);
        reservations.notifyCancelled(pnr, cancelled.size(), quote.refundAmount(), r.getReason());   // Team 6

        boolean everyoneCancelled = reservations.activePassengers(pnr).isEmpty();
        payment.setStatus(everyoneCancelled ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED);
        payment.setUpdatedAt(OffsetDateTime.now());
        payments.save(payment);
        return r;
    }

    /**
     * A payment arrived that could not confirm its booking (the hold had expired,
     * the amount had changed, or the booking was already paid): give it all back.
     */
    @Transactional
    public Refund refundUnconfirmedPayment(Payment payment, String why) {
        Refund r = new Refund();
        r.setPnr(payment.getPnr());
        r.setPaymentId(payment.getId());
        r.setUserId(payment.getUserId());
        r.setAmount(payment.getAmount());
        r.setRefundPercent(BigDecimal.valueOf(100));
        r.setReason("Automatic: booking not confirmed (" + why + ")");
        issue(r, payment, r.getReason(), payment.getUserId(), false);
        refunds.save(r);

        payment.setStatus(PaymentStatus.REFUNDED);
        payment.setUpdatedAt(OffsetDateTime.now());
        payments.save(payment);
        return r;
    }

    /** Called from the webhook when Razorpay reports the final refund state. */
    @Transactional
    public void updateStatus(String razorpayRefundId, RefundStatus status) {
        refunds.findByRazorpayRefundId(razorpayRefundId).ifPresentOrElse(r -> {
            r.setStatus(status);
            refunds.save(r);
        }, () -> log.warn("Webhook for unknown refund {}", razorpayRefundId));
    }

    public List<Refund> forBooking(String pnr, Integer requestingUserId, boolean isStaffOrAdmin) {
        ownedBooking(pnr, requestingUserId, isStaffOrAdmin);
        return refunds.findByPnrOrderByIdDesc(pnr);
    }

    public List<Refund> forUser(Integer userId) {
        return refunds.findByUserIdOrderByIdDesc(userId);
    }

    // ---------- helpers ----------

    private static Instant departure(Reservation booking) {
        return booking.departsAt() != null ? booking.departsAt()
                : booking.journeyDate().atStartOfDay(RAILWAY_ZONE).toInstant();
    }

    /** The refund policy for a train leaving at the start of departureDate (India), asked at time now. */
    Policy policyFor(LocalDate departureDate, Instant now) {
        return policyFor(departureDate.atStartOfDay(RAILWAY_ZONE).toInstant(), now);
    }

    /** The refund policy for a train leaving at departure, asked at time now. */
    Policy policyFor(Instant departure, Instant now) {
        double hoursLeft = Duration.between(now, departure).toMinutes() / 60.0;

        if (hoursLeft >= fullWindowHours) {
            return new Policy(fullWindowPercent, "Cancelled " + fullWindowHours + "h or more before departure");
        } else if (hoursLeft >= midWindowHours) {
            return new Policy(midWindowPercent, "Cancelled " + midWindowHours + "-" + fullWindowHours + "h before departure");
        } else if (hoursLeft >= lateWindowHours) {
            return new Policy(lateWindowPercent, "Cancelled " + lateWindowHours + "-" + midWindowHours + "h before departure");
        }
        return new Policy(BigDecimal.ZERO, "Not refundable: less than " + lateWindowHours + "h to departure");
    }

    private static RefundQuote buildQuote(String pnr, BigDecimal paid, Policy policy) {
        BigDecimal refund = Money.percentOf(paid, policy.percent());
        return new RefundQuote(pnr, paid, policy.percent(), refund, paid.subtract(refund), policy.note());
    }

    /** Sends the refund to Razorpay and records its id and status on r. */
    private void issue(Refund r, Payment payment, String reason, Integer userId, boolean byStaff) {
        try {
            JSONObject req = new JSONObject();
            req.put("amount", Money.toPaise(r.getAmount()));
            req.put("speed", "normal");
            req.put("notes", new JSONObject()
                    .put("pnr", r.getPnr())
                    .put("userId", String.valueOf(userId))
                    .put("processedByStaff", byStaff ? String.valueOf(userId) : "self-service")
                    .put("reason", reason));

            com.razorpay.Refund rzpRefund = client.payments.refund(payment.getRazorpayPaymentId(), req);
            r.setRazorpayRefundId(rzpRefund.get("id"));
            String rzpStatus = rzpRefund.get("status");
            r.setStatus("processed".equalsIgnoreCase(rzpStatus) ? RefundStatus.PROCESSED : RefundStatus.PENDING);
        } catch (RazorpayException e) {
            log.error("Razorpay refund failed", e);
            throw ApiException.gateway("The payment gateway refused the refund, so nothing was cancelled. "
                    + "Please try again later.");
        }
    }

    /** The booking, if the caller owns it or is staff; otherwise 404, so PNRs can't be probed. */
    private Reservation ownedBooking(String pnr, Integer userId, boolean isStaffOrAdmin) {
        return reservations.find(pnr)
                .filter(b -> isStaffOrAdmin || (userId != null && b.userId() == userId))
                .orElseThrow(() -> ApiException.notFound("Booking not found: " + pnr));
    }

    private static void requireConfirmed(Reservation booking) {
        if (!"CONFIRMED".equals(booking.status())) {
            throw ApiException.conflict("Only paid (CONFIRMED) bookings are refunded here (status "
                    + booking.status() + "); unpaid bookings are cancelled through the booking service");
        }
    }

    private Payment getPaidPayment(String pnr) {
        return payments.findFirstByPnrAndStatusInOrderByIdDesc(pnr,
                        List.of(PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED))
                .orElseThrow(() -> ApiException.conflict("No successful payment found for booking " + pnr));
    }
}
