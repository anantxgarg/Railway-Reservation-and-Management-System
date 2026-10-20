package com.example.gateway.web;

import com.example.gateway.service.RefundService;
import com.example.gateway.web.Dtos.RefundQuote;
import com.example.gateway.web.Dtos.RefundRequest;
import com.example.gateway.web.Dtos.RefundResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/refunds")
@RequiredArgsConstructor
public class RefundController {

    private final RefundService refundService;

    /** Shows the passenger or staff how much would be refunded without committing. */
    @GetMapping("/preview/{bookingId}")
    public RefundQuote preview(@PathVariable Long bookingId) {
        return refundService.quote(bookingId);
    }

    /** Cancels the booking and initiates the Razorpay refund. */
    @PostMapping
    @PreAuthorize("hasAnyRole('CUSTOMER', 'STAFF', 'ADMIN')")
    public RefundResponse refund(@Valid @RequestBody RefundRequest req, Authentication auth) {
        Integer userId = extractUserId(auth);
        Integer staffId = isStaffOrAdmin(auth) ? userId : null;
        return RefundResponse.from(refundService.requestRefund(req.bookingId(), req.reason(), userId, staffId));
    }

    @GetMapping("/booking/{bookingId}")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'STAFF', 'ADMIN')")
    public List<RefundResponse> forBooking(@PathVariable Long bookingId, Authentication auth) {
        Integer userId = extractUserId(auth);
        boolean isStaffOrAdmin = isStaffOrAdmin(auth);
        return refundService.forBooking(bookingId, userId, isStaffOrAdmin).stream()
                .map(RefundResponse::from)
                .toList();
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('CUSTOMER')")
    public List<RefundResponse> myRefunds(Authentication auth) {
        Integer userId = extractUserId(auth);
        return refundService.forUser(userId).stream()
                .map(RefundResponse::from)
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
