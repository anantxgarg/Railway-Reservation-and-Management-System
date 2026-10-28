package com.example.gateway.web;

import com.example.gateway.domain.*;
import com.example.gateway.repo.ConcessionRuleRepository;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public final class Dtos {

    private Dtos() {
    }

    // ---------- Concession ----------
    /** percent is null for a FIXED_AMOUNT concession. */
    public record ConcessionResult(
            String category, BigDecimal baseFare, BigDecimal percent,
            BigDecimal concessionAmount, BigDecimal finalAmount) {
    }

    /** A concession from the shared concession_rule table (C3), for the booking form. */
    public record ConcessionRuleResponse(
            int concessionId, String category, String name, String eligibility,
            String discountType, BigDecimal discountValue, Integer minAge, Integer maxAge, String description) {

        public static ConcessionRuleResponse from(ConcessionRuleRepository.Rule r) {
            return new ConcessionRuleResponse(r.concessionId(), r.category(), r.name(), r.eligibility(),
                    r.discountType(), r.discountValue(), r.minAge(), r.maxAge(), r.description());
        }
    }

    /**
     * Documents for the concession a passenger of a booking (C3 passenger_id) was
     * booked with. category is optional; when given it must be that concession.
     */
    public record ApplyConcessionRequest(
            @NotBlank String pnr,
            @NotNull Integer passengerId,
            String category,
            String idCardType,
            String idCardNumber,
            String documentReferenceUrl) {
    }

    public record ConcessionReviewRequest(
            @NotNull ConcessionStatus status,
            String remarks) {
    }

    public record ConcessionApplicationResponse(
            Long id, String pnr, Integer passengerId, Integer userId, String passengerName,
            String category, String idCardType, String idCardNumber,
            String documentReferenceUrl, BigDecimal discountPercent, BigDecimal discountAmount,
            ConcessionStatus status, Integer verifiedByStaffId, String remarks,
            OffsetDateTime createdAt, OffsetDateTime updatedAt) {

        public static ConcessionApplicationResponse from(ConcessionApplication c) {
            return new ConcessionApplicationResponse(
                    c.getId(), c.getPnr(), c.getPassengerId(), c.getUserId(), c.getPassengerName(),
                    c.getCategory(), c.getIdCardType(), c.getIdCardNumber(),
                    c.getDocumentReferenceUrl(), c.getDiscountPercent(), c.getDiscountAmount(),
                    c.getStatus(), c.getVerifiedByStaffId(), c.getRemarks(),
                    c.getCreatedAt(), c.getUpdatedAt()
            );
        }
    }

    // ---------- Payments ----------
    /** Pay for a booking made through the booking service. The amount comes from the booking. */
    public record CreateOrderRequest(@NotBlank String pnr) {
    }

    public record OrderResponse(
            String pnr, String keyId, String orderId, long amountInPaise, String currency) {
    }

    public record VerifyPaymentRequest(
            @NotBlank String razorpayOrderId,
            @NotBlank String razorpayPaymentId,
            @NotBlank String razorpaySignature) {
    }

    public record PaymentResponse(
            Long id, String pnr, Integer userId, String razorpayOrderId, String razorpayPaymentId,
            BigDecimal amount, String currency, PaymentStatus status) {

        public static PaymentResponse from(Payment p) {
            return new PaymentResponse(p.getId(), p.getPnr(), p.getUserId(), p.getRazorpayOrderId(),
                    p.getRazorpayPaymentId(), p.getAmount(), p.getCurrency(), p.getStatus());
        }
    }

    // ---------- Refunds ----------
    /**
     * Cancel passengers of a paid booking and refund them. No passengerIds (or null)
     * cancels everyone still on the booking.
     */
    public record RefundRequest(@NotBlank String pnr, List<Integer> passengerIds, String reason) {
    }

    /** paidAmount is what was paid for the passengers being cancelled. */
    public record RefundQuote(
            String pnr, BigDecimal paidAmount, BigDecimal refundPercent,
            BigDecimal refundAmount, BigDecimal cancellationCharge, String note) {
    }

    public record RefundResponse(
            Long id, String pnr, Long paymentId, Integer userId, String razorpayRefundId,
            BigDecimal amount, BigDecimal refundPercent, String reason, RefundStatus status,
            Integer processedByStaffId) {

        public static RefundResponse from(Refund r) {
            return new RefundResponse(r.getId(), r.getPnr(), r.getPaymentId(), r.getUserId(),
                    r.getRazorpayRefundId(), r.getAmount(), r.getRefundPercent(),
                    r.getReason(), r.getStatus(), r.getProcessedByStaffId());
        }
    }
}
