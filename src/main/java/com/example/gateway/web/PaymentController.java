package com.example.gateway.web;

import com.example.gateway.service.PaymentService;
import com.example.gateway.service.WebhookService;
import com.example.gateway.web.Dtos.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;
    private final WebhookService webhookService;

    @PostMapping("/order")
    public OrderResponse createOrder(@Valid @RequestBody CreateOrderRequest req, Authentication auth) {
        Integer userId = extractUserId(auth);
        return paymentService.createOrder(req.bookingId(), userId);
    }

    @PostMapping("/verify")
    public PaymentResponse verify(@Valid @RequestBody VerifyPaymentRequest req, Authentication auth) {
        Integer userId = extractUserId(auth);
        return PaymentResponse.from(paymentService.verify(
                req.razorpayOrderId(), req.razorpayPaymentId(), req.razorpaySignature(), userId));
    }

    /** Razorpay calls this callback directly. Raw payload is required for HMAC signature verification. */
    @PostMapping("/webhook")
    public ResponseEntity<Map<String, String>> webhook(
            @RequestBody String payload,
            @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature) {
        webhookService.handle(payload, signature);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    @GetMapping("/booking/{bookingId}")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'STAFF', 'ADMIN')")
    public List<PaymentResponse> forBooking(@PathVariable Long bookingId, Authentication auth) {
        Integer userId = extractUserId(auth);
        boolean isStaffOrAdmin = isStaffOrAdmin(auth);
        return paymentService.forBooking(bookingId, userId, isStaffOrAdmin).stream()
                .map(PaymentResponse::from)
                .toList();
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('CUSTOMER')")
    public List<PaymentResponse> myPayments(Authentication auth) {
        Integer userId = extractUserId(auth);
        return paymentService.forUser(userId).stream()
                .map(PaymentResponse::from)
                .toList();
    }

    private Integer extractUserId(Authentication auth) {
        if (auth == null || auth.getName() == null) return null;
        try {
            return Integer.valueOf(auth.getName());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private boolean isStaffOrAdmin(Authentication auth) {
        if (auth == null) return false;
        return auth.getAuthorities().stream().anyMatch(a ->
                a.getAuthority().equals("ROLE_STAFF") || a.getAuthority().equals("ROLE_ADMIN"));
    }
}
