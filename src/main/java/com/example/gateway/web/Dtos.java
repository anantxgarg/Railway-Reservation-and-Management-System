package com.example.gateway.web;

import com.example.gateway.domain.*;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public final class Dtos {

    private Dtos() {
    }

    // ---------- Bookings ----------
    public record CreateBookingRequest(
            @NotBlank String passengerName,
            @NotBlank @Email String email,
            @NotBlank String phone,
            @NotBlank String origin,
            @NotBlank String destination,
            @NotNull @Future LocalDateTime departureTime,
            @NotNull PassengerCategory category,
            @NotNull @DecimalMin("1.00") BigDecimal baseFare) {
    }

    public record BookingResponse(
            Long id, String passengerName, String email, String phone,
            String origin, String destination, LocalDateTime departureTime,
            PassengerCategory category, BigDecimal baseFare,
            BigDecimal concessionPercent, BigDecimal concessionAmount,
            BigDecimal finalAmount, BookingStatus status) {

        public static BookingResponse from(Booking b) {
            return new BookingResponse(b.getId(), b.getPassengerName(), b.getEmail(), b.getPhone(),
                    b.getOrigin(), b.getDestination(), b.getDepartureTime(),
                    b.getCategory(), b.getBaseFare(), b.getConcessionPercent(),
                    b.getConcessionAmount(), b.getFinalAmount(), b.getStatus());
        }
    }

    // ---------- Concession ----------
    public record ConcessionResult(
            PassengerCategory category, BigDecimal baseFare, BigDecimal percent,
            BigDecimal concessionAmount, BigDecimal finalAmount) {
    }

    public record ApplyConcessionRequest(
            @NotNull Long bookingId,
            @NotNull PassengerCategory category,
            String idCardType,
            String idCardNumber,
            String documentReferenceUrl) {
    }

    public record ConcessionReviewRequest(
            @NotNull ConcessionStatus status,
            String remarks) {
    }

    public record ConcessionApplicationResponse(
            Long id, Long bookingId, Integer userId, String passengerName,
            PassengerCategory category, String idCardType, String idCardNumber,
            String documentReferenceUrl, BigDecimal discountPercent, BigDecimal discountAmount,
            ConcessionStatus status, Integer verifiedByStaffId, String remarks,
            LocalDateTime createdAt, LocalDateTime updatedAt) {

        public static ConcessionApplicationResponse from(ConcessionApplication c) {
            return new ConcessionApplicationResponse(
                    c.getId(), c.getBookingId(), c.getUserId(), c.getPassengerName(),
                    c.getCategory(), c.getIdCardType(), c.getIdCardNumber(),
                    c.getDocumentReferenceUrl(), c.getDiscountPercent(), c.getDiscountAmount(),
                    c.getStatus(), c.getVerifiedByStaffId(), c.getRemarks(),
                    c.getCreatedAt(), c.getUpdatedAt()
            );
        }
    }

    // ---------- Payments ----------
    public record CreateOrderRequest(@NotNull Long bookingId) {
    }

    public record OrderResponse(
            Long bookingId, String keyId, String orderId, long amountInPaise, String currency) {
    }

    public record VerifyPaymentRequest(
            @NotBlank String razorpayOrderId,
            @NotBlank String razorpayPaymentId,
            @NotBlank String razorpaySignature) {
    }

    public record PaymentResponse(
            Long id, Long bookingId, Integer userId, String razorpayOrderId, String razorpayPaymentId,
            BigDecimal amount, String currency, PaymentStatus status) {

        public static PaymentResponse from(Payment p) {
            return new PaymentResponse(p.getId(), p.getBookingId(), p.getUserId(), p.getRazorpayOrderId(),
                    p.getRazorpayPaymentId(), p.getAmount(), p.getCurrency(), p.getStatus());
        }
    }

    // ---------- Refunds ----------
    public record RefundRequest(@NotNull Long bookingId, String reason) {
    }

    public record RefundQuote(
            Long bookingId, BigDecimal paidAmount, BigDecimal refundPercent,
            BigDecimal refundAmount, BigDecimal cancellationCharge, String note) {
    }

    public record RefundResponse(
            Long id, Long bookingId, Long paymentId, Integer userId, String razorpayRefundId,
            BigDecimal amount, BigDecimal refundPercent, String reason, RefundStatus status,
            Integer processedByStaffId) {

        public static RefundResponse from(Refund r) {
            return new RefundResponse(r.getId(), r.getBookingId(), r.getPaymentId(), r.getUserId(),
                    r.getRazorpayRefundId(), r.getAmount(), r.getRefundPercent(),
                    r.getReason(), r.getStatus(), r.getProcessedByStaffId());
        }
    }
}
