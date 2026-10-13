package com.example.gateway.web;

import com.example.gateway.domain.ConcessionApplication;
import com.example.gateway.service.BookingService;
import com.example.gateway.service.ConcessionService;
import com.example.gateway.web.Dtos.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/concessions")
@RequiredArgsConstructor
public class ConcessionController {

    private final ConcessionService concessionService;
    private final BookingService bookingService;

    @PostMapping("/apply")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('CUSTOMER', 'ADMIN')")
    public ConcessionApplicationResponse apply(
            @Valid @RequestBody ApplyConcessionRequest req,
            Authentication auth) {
        Integer userId = auth != null && auth.getName() != null ? Integer.valueOf(auth.getName()) : null;
        var booking = bookingService.get(req.bookingId());

        ConcessionApplication app = concessionService.createApplication(
                req.bookingId(),
                userId,
                booking.getPassengerName(),
                req.category(),
                booking.getBaseFare(),
                req.idCardType(),
                req.idCardNumber(),
                req.documentReferenceUrl()
        );
        return ConcessionApplicationResponse.from(app);
    }

    @GetMapping("/pending")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public List<ConcessionApplicationResponse> getPending() {
        return concessionService.getPendingApplications().stream()
                .map(ConcessionApplicationResponse::from)
                .toList();
    }

    @PostMapping("/{id}/review")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public ConcessionApplicationResponse review(
            @PathVariable Long id,
            @Valid @RequestBody ConcessionReviewRequest req,
            Authentication auth) {
        Integer staffId = auth != null && auth.getName() != null ? Integer.valueOf(auth.getName()) : 1;
        return ConcessionApplicationResponse.from(
                concessionService.review(id, req.status(), staffId, req.remarks()));
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('CUSTOMER')")
    public List<ConcessionApplicationResponse> getMyApplications(Authentication auth) {
        Integer userId = Integer.valueOf(auth.getName());
        return concessionService.getForUser(userId).stream()
                .map(ConcessionApplicationResponse::from)
                .toList();
    }

    @GetMapping("/booking/{bookingId}")
    public ConcessionApplicationResponse getByBooking(@PathVariable Long bookingId) {
        return ConcessionApplicationResponse.from(concessionService.getByBooking(bookingId));
    }
}
