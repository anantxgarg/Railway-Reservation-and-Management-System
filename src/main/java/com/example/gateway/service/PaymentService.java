package com.example.gateway.service;

import com.example.gateway.domain.Payment;
import com.example.gateway.domain.PaymentStatus;
import com.example.gateway.repo.PaymentRepository;
import com.example.gateway.repo.ReservationRepository;
import com.example.gateway.repo.ReservationRepository.Reservation;
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

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Pays for bookings made through the booking service (Team 3).
 *
 * The amount always comes from the booking (booking.total_fare), never from the
 * browser. When a payment succeeds, confirm_booking(pnr) runs in the same
 * transaction that marks the payment PAID. A payment that cannot confirm its
 * booking (hold expired, amount changed, booking already paid) is refunded in full.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentService {

    private static final long MIN_AMOUNT_PAISE = 100; // Razorpay minimum is Rs 1

    private final RazorpayClient client;
    private final ReservationRepository reservations;
    private final PaymentRepository payments;
    private final RefundService refundService;

    @Value("${razorpay.key-id}")
    private String keyId;

    @Value("${razorpay.key-secret}")
    private String keySecret;

    /** Step 1: create a Razorpay order for the booking's amount. Only the booking's owner pays. */
    @Transactional
    public OrderResponse createOrder(String pnr, Integer userId) {
        Reservation booking = reservations.find(pnr)
                .filter(b -> userId != null && b.userId() == userId)
                .orElseThrow(() -> ApiException.notFound("Booking not found: " + pnr));
        if (!"HELD".equals(booking.status())) {
            throw ApiException.conflict("Booking is not awaiting payment (status " + booking.status() + ")");
        }
        if (!booking.holdActive()) {
            throw ApiException.conflict("The 15-minute payment hold has expired; please book again");
        }

        // Reuse an open order for the same amount so double-clicks don't create duplicate orders.
        // (If passengers were cancelled since, the amount changed and a new order is needed.)
        Payment open = payments.findFirstByPnrAndStatusOrderByIdDesc(pnr, PaymentStatus.CREATED).orElse(null);
        if (open != null && open.getAmount().compareTo(booking.totalFare()) == 0) {
            return toOrderResponse(open);
        }

        long paise = Money.toPaise(booking.totalFare());
        if (paise < MIN_AMOUNT_PAISE) {
            throw ApiException.badRequest("Payable amount is below Razorpay's minimum of Rs 1");
        }

        try {
            JSONObject req = new JSONObject();
            req.put("amount", paise);
            req.put("currency", "INR");
            req.put("receipt", "pnr_" + pnr);
            req.put("notes", new JSONObject()
                    .put("pnr", pnr)
                    .put("userId", String.valueOf(userId)));

            Order order = client.orders.create(req);
            String orderId = order.get("id");

            Payment p = new Payment();
            p.setPnr(pnr);
            p.setUserId(userId);
            p.setRazorpayOrderId(orderId);
            p.setAmount(booking.totalFare());
            p.setStatus(PaymentStatus.CREATED);
            return toOrderResponse(payments.save(p));
        } catch (RazorpayException e) {
            log.error("Razorpay order creation failed", e);
            throw ApiException.gateway("Could not create Razorpay order: " + e.getMessage());
        }
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

        Payment payment = payments.findByRazorpayOrderId(orderId)
                .filter(p -> p.getUserId() != null && p.getUserId().equals(userId))
                .orElseThrow(() -> ApiException.notFound("No payment for order " + orderId));
        return markPaid(payment.getRazorpayOrderId(), paymentId);
    }

    /**
     * Shared by verify() and the webhook; idempotent so whichever arrives first wins.
     * The payment row and then the booking row are locked, so the two can't overlap,
     * and the hold-expiry job (which skips locked bookings) can't expire the booking
     * halfway through.
     */
    @Transactional
    public Payment markPaid(String orderId, String paymentId) {
        Payment p = payments.findForUpdateByRazorpayOrderId(orderId)
                .orElseThrow(() -> ApiException.notFound("No payment for order " + orderId));
        if (p.getStatus() != PaymentStatus.CREATED) {
            return p;
        }
        p.setStatus(PaymentStatus.PAID);
        p.setRazorpayPaymentId(paymentId);
        p.setUpdatedAt(OffsetDateTime.now());
        payments.save(p);

        Reservation booking = reservations.lock(p.getPnr()).orElseThrow();
        String problem = whyNotConfirmable(booking, p);
        if (problem == null) {
            reservations.confirm(p.getPnr());
        } else {
            log.warn("Payment {} for PNR {} cannot confirm the booking ({}); refunding it", paymentId, p.getPnr(), problem);
            refundService.refundUnconfirmedPayment(p, problem);
        }
        return p;
    }

    /** Null when this payment may confirm the booking, otherwise the reason it can't. */
    private static String whyNotConfirmable(Reservation booking, Payment p) {
        if (!"HELD".equals(booking.status())) {
            return "booking is " + booking.status();
        }
        if (!booking.holdActive()) {
            return "the payment hold expired before the payment arrived";
        }
        if (booking.totalFare().compareTo(p.getAmount()) != 0) {
            return "the booking amount changed after the order was created";
        }
        return null;
    }

    /** Payment records for a booking: its owner, or staff. */
    public List<Payment> forBooking(String pnr, Integer requestingUserId, boolean isStaffOrAdmin) {
        reservations.find(pnr)
                .filter(b -> isStaffOrAdmin || (requestingUserId != null && b.userId() == requestingUserId))
                .orElseThrow(() -> ApiException.notFound("Booking not found: " + pnr));
        return payments.findByPnrOrderByIdDesc(pnr);
    }

    public List<Payment> forUser(Integer userId) {
        return payments.findByUserIdOrderByIdDesc(userId);
    }

    private OrderResponse toOrderResponse(Payment p) {
        return new OrderResponse(p.getPnr(), keyId, p.getRazorpayOrderId(),
                Money.toPaise(p.getAmount()), p.getCurrency());
    }
}
