package com.example.gateway.service;

import com.example.gateway.domain.Booking;
import com.example.gateway.domain.BookingStatus;
import com.example.gateway.domain.Payment;
import com.example.gateway.domain.PaymentStatus;
import com.example.gateway.repo.BookingRepository;
import com.example.gateway.repo.PaymentRepository;
import com.example.gateway.web.ApiException;
import com.example.gateway.web.Dtos.OrderResponse;
import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import com.razorpay.Utils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentService {

    private static final long MIN_AMOUNT_PAISE = 100; // Razorpay minimum is Rs 1

    private final RazorpayClient client;
    private final BookingRepository bookings;
    private final PaymentRepository payments;

    @Value("${razorpay.key-id}")
    private String keyId;

    @Value("${razorpay.key-secret}")
    private String keySecret;

    /** Step 1: create a Razorpay order for the trusted booking amount. */
    @Transactional
    public OrderResponse createOrder(Long bookingId, Integer userId) {
        Booking booking = bookings.findById(bookingId)
                .orElseThrow(() -> ApiException.notFound("Booking not found: " + bookingId));
        if (booking.getStatus() != BookingStatus.PENDING_PAYMENT) {
            throw ApiException.conflict("Booking is not awaiting payment (status " + booking.getStatus() + ")");
        }

        // Reuse an open order so double-clicks don't create duplicate orders.
        Payment open = payments.findFirstByBookingIdAndStatus(bookingId, PaymentStatus.CREATED).orElse(null);
        if (open != null) {
            return toOrderResponse(open);
        }

        long paise = Money.toPaise(booking.getFinalAmount());
        if (paise < MIN_AMOUNT_PAISE) {
            throw ApiException.badRequest("Payable amount is below Razorpay's minimum of Rs 1");
        }

        try {
            JSONObject req = new JSONObject();
            req.put("amount", paise);
            req.put("currency", "INR");
            req.put("receipt", "booking_" + bookingId);
            req.put("notes", new JSONObject()
                    .put("bookingId", String.valueOf(bookingId))
                    .put("userId", userId != null ? String.valueOf(userId) : "anonymous"));

            Order order = client.orders.create(req);
            String orderId = order.get("id");

            Payment p = new Payment();
            p.setBookingId(bookingId);
            p.setUserId(userId);
            p.setRazorpayOrderId(orderId);
            p.setAmount(booking.getFinalAmount());
            p.setStatus(PaymentStatus.CREATED);
            return toOrderResponse(payments.save(p));
        } catch (RazorpayException e) {
            log.error("Razorpay order creation failed", e);
            throw ApiException.gateway("Could not create Razorpay order: " + e.getMessage());
        }
    }

    public OrderResponse createOrder(Long bookingId) {
        return createOrder(bookingId, null);
    }

    /**
     * Step 2: verify payment signature upon checkout callback.
     */
    @Transactional
    public Payment verify(String orderId, String paymentId, String signature, Integer userId) {
        JSONObject attrs = new JSONObject();
        attrs.put("razorpay_order_id", orderId);
        attrs.put("razorpay_payment_id", paymentId);
        attrs.put("razorpay_signature", signature);

        boolean valid;
        try {
            valid = Utils.verifyPaymentSignature(attrs, keySecret);
        } catch (RazorpayException e) {
            throw ApiException.badRequest("Signature verification failed: " + e.getMessage());
        }
        if (!valid) {
            throw ApiException.badRequest("Invalid payment signature");
        }

        Payment payment = markPaid(orderId, paymentId);
        if (userId != null && payment.getUserId() == null) {
            payment.setUserId(userId);
            payments.save(payment);
        }
        return payment;
    }

    public Payment verify(String orderId, String paymentId, String signature) {
        return verify(orderId, paymentId, signature, null);
    }

    /** Shared by verify() and the webhook; idempotent so whichever arrives first wins. */
    @Transactional
    public Payment markPaid(String orderId, String paymentId) {
        Payment p = payments.findByRazorpayOrderId(orderId)
                .orElseThrow(() -> ApiException.notFound("No payment for order " + orderId));
        if (p.getStatus() == PaymentStatus.CREATED) {
            p.setStatus(PaymentStatus.PAID);
            p.setRazorpayPaymentId(paymentId);
            p.setUpdatedAt(LocalDateTime.now());
            payments.save(p);

            Booking b = bookings.findById(p.getBookingId()).orElseThrow();
            if (b.getStatus() == BookingStatus.PENDING_PAYMENT) {
                b.setStatus(BookingStatus.CONFIRMED);
                bookings.save(b);
            }
        }
        return p;
    }

    public List<Payment> forBooking(Long bookingId) {
        return payments.findByBookingIdOrderByIdDesc(bookingId);
    }

    public List<Payment> forBooking(Long bookingId, Integer requestingUserId, boolean isStaffOrAdmin) {
        List<Payment> list = payments.findByBookingIdOrderByIdDesc(bookingId);
        if (!isStaffOrAdmin && requestingUserId != null) {
            boolean hasUnauthorized = list.stream()
                    .anyMatch(p -> p.getUserId() != null && !p.getUserId().equals(requestingUserId));
            if (hasUnauthorized) {
                throw ApiException.conflict("Access denied: You do not own this booking's payment records");
            }
        }
        return list;
    }

    public List<Payment> forUser(Integer userId) {
        return payments.findByUserIdOrderByIdDesc(userId);
    }

    private OrderResponse toOrderResponse(Payment p) {
        return new OrderResponse(p.getBookingId(), keyId, p.getRazorpayOrderId(),
                Money.toPaise(p.getAmount()), p.getCurrency());
    }
}
