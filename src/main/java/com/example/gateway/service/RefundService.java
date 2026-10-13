package com.example.gateway.service;

import com.example.gateway.domain.*;
import com.example.gateway.repo.BookingRepository;
import com.example.gateway.repo.PaymentRepository;
import com.example.gateway.repo.RefundRepository;
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
import java.time.LocalDateTime;
import java.util.List;

/**
 * Refund = cancellation. Calculated on the amount actually PAID (after concession),
 * strictly adhering to departure time windows.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RefundService {

    private final RazorpayClient client;
    private final BookingRepository bookings;
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

    /** Shows the passenger what they'd get back without actually refunding. */
    public RefundQuote quote(Long bookingId) {
        Booking booking = getBooking(bookingId);
        Payment payment = getPaidPayment(bookingId);
        return buildQuote(booking, payment);
    }

    @Transactional
    public Refund requestRefund(Long bookingId, String reason, Integer userId, Integer staffId) {
        Booking booking = getBooking(bookingId);
        if (booking.getStatus() != BookingStatus.CONFIRMED) {
            throw ApiException.conflict("Only confirmed bookings can be refunded (status " + booking.getStatus() + ")");
        }
        Payment payment = getPaidPayment(bookingId);

        // Security check: Customer can only cancel their own booking (Staff/Admin can override)
        if (staffId == null && userId != null && payment.getUserId() != null && !payment.getUserId().equals(userId)) {
            throw ApiException.conflict("Access denied: You can only request refunds for your own bookings");
        }

        RefundQuote quote = buildQuote(booking, payment);
        if (quote.refundAmount().signum() <= 0) {
            throw ApiException.badRequest(quote.note());
        }

        try {
            JSONObject req = new JSONObject();
            req.put("amount", Money.toPaise(quote.refundAmount()));
            req.put("speed", "normal");
            req.put("notes", new JSONObject()
                    .put("bookingId", String.valueOf(bookingId))
                    .put("userId", userId != null ? String.valueOf(userId) : "anonymous")
                    .put("processedByStaff", staffId != null ? String.valueOf(staffId) : "self-service")
                    .put("reason", reason == null ? "Passenger cancellation" : reason));

            com.razorpay.Refund rzpRefund = client.payments.refund(payment.getRazorpayPaymentId(), req);
            String rzpId = rzpRefund.get("id");
            String rzpStatus = rzpRefund.get("status");

            Refund r = new Refund();
            r.setBookingId(bookingId);
            r.setPaymentId(payment.getId());
            r.setUserId(userId != null ? userId : payment.getUserId());
            r.setProcessedByStaffId(staffId);
            r.setRazorpayRefundId(rzpId);
            r.setAmount(quote.refundAmount());
            r.setRefundPercent(quote.refundPercent());
            r.setReason(reason);
            r.setStatus("processed".equalsIgnoreCase(rzpStatus) ? RefundStatus.PROCESSED : RefundStatus.PENDING);
            refunds.save(r);

            booking.setStatus(BookingStatus.CANCELLED);
            bookings.save(booking);
            payment.setStatus(PaymentStatus.REFUNDED);
            payment.setUpdatedAt(LocalDateTime.now());
            payments.save(payment);
            return r;
        } catch (RazorpayException e) {
            log.error("Razorpay refund failed", e);
            throw ApiException.gateway("Could not create refund: " + e.getMessage());
        }
    }

    public Refund requestRefund(Long bookingId, String reason) {
        return requestRefund(bookingId, reason, null, null);
    }

    /** Called from the webhook when Razorpay reports the final refund state. */
    @Transactional
    public void updateStatus(String razorpayRefundId, RefundStatus status) {
        refunds.findByRazorpayRefundId(razorpayRefundId).ifPresentOrElse(r -> {
            r.setStatus(status);
            refunds.save(r);
        }, () -> log.warn("Webhook for unknown refund {}", razorpayRefundId));
    }

    public List<Refund> forBooking(Long bookingId) {
        return refunds.findByBookingIdOrderByIdDesc(bookingId);
    }

    public List<Refund> forBooking(Long bookingId, Integer requestingUserId, boolean isStaffOrAdmin) {
        List<Refund> list = refunds.findByBookingIdOrderByIdDesc(bookingId);
        if (!isStaffOrAdmin && requestingUserId != null) {
            boolean hasUnauthorized = list.stream()
                    .anyMatch(r -> r.getUserId() != null && !r.getUserId().equals(requestingUserId));
            if (hasUnauthorized) {
                throw ApiException.conflict("Access denied: You do not own this refund record");
            }
        }
        return list;
    }

    public List<Refund> forUser(Integer userId) {
        return refunds.findByUserIdOrderByIdDesc(userId);
    }

    // ---------- helpers ----------

    private RefundQuote buildQuote(Booking booking, Payment payment) {
        BigDecimal paid = payment.getAmount();
        double hoursLeft = Duration.between(LocalDateTime.now(), booking.getDepartureTime()).toMinutes() / 60.0;

        BigDecimal percent;
        String note;
        if (hoursLeft >= fullWindowHours) {
            percent = fullWindowPercent;
            note = "Cancelled " + fullWindowHours + "h or more before departure";
        } else if (hoursLeft >= midWindowHours) {
            percent = midWindowPercent;
            note = "Cancelled " + midWindowHours + "-" + fullWindowHours + "h before departure";
        } else if (hoursLeft >= lateWindowHours) {
            percent = lateWindowPercent;
            note = "Cancelled " + lateWindowHours + "-" + midWindowHours + "h before departure";
        } else {
            percent = BigDecimal.ZERO;
            note = "Not refundable: less than " + lateWindowHours + "h to departure";
        }

        BigDecimal refund = Money.percentOf(paid, percent);
        return new RefundQuote(booking.getId(), paid, percent, refund, paid.subtract(refund), note);
    }

    private Booking getBooking(Long id) {
        return bookings.findById(id).orElseThrow(() -> ApiException.notFound("Booking not found: " + id));
    }

    private Payment getPaidPayment(Long bookingId) {
        return payments.findFirstByBookingIdAndStatus(bookingId, PaymentStatus.PAID)
                .orElseThrow(() -> ApiException.conflict("No successful payment found for booking " + bookingId));
    }
}
