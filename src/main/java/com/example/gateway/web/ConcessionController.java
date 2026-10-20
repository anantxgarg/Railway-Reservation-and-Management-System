package com.example.gateway.web;

import com.example.gateway.domain.ConcessionApplication;
import com.example.gateway.domain.PassengerCategory;
import com.example.gateway.service.ConcessionService;
import com.example.gateway.web.Dtos.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/concessions")
@RequiredArgsConstructor
public class ConcessionController {

    private final ConcessionService concessionService;

    /** Lets the UI show the discounted fare before the passenger commits. */
    @GetMapping("/preview")
    public ConcessionResult preview(
            @RequestParam(required = false, defaultValue = "GENERAL") PassengerCategory category,
            @RequestParam(required = false, defaultValue = "1000.00") BigDecimal baseFare) {
        return concessionService.calculate(category, baseFare);
    }

    @PostMapping("/apply")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('CUSTOMER', 'ADMIN')")
    public ConcessionApplicationResponse apply(
            @Valid @RequestBody ApplyConcessionRequest req,
            Authentication auth) {
        ConcessionApplication app = concessionService.createApplication(
                req.pnr(),
                req.passengerId(),
                Integer.valueOf(auth.getName()),
                hasRole(auth, "ROLE_ADMIN"),
                req.category(),
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
        return ConcessionApplicationResponse.from(
                concessionService.review(id, req.status(), Integer.valueOf(auth.getName()), req.remarks()));
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('CUSTOMER')")
    public List<ConcessionApplicationResponse> getMyApplications(Authentication auth) {
        Integer userId = Integer.valueOf(auth.getName());
        return concessionService.getForUser(userId).stream()
                .map(ConcessionApplicationResponse::from)
                .toList();
    }

    @GetMapping("/booking/{pnr}")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'STAFF', 'ADMIN')")
    public List<ConcessionApplicationResponse> getByBooking(@PathVariable String pnr, Authentication auth) {
        boolean staff = hasRole(auth, "ROLE_STAFF") || hasRole(auth, "ROLE_ADMIN");
        return concessionService.getByBooking(pnr, Integer.valueOf(auth.getName()), staff).stream()
                .map(ConcessionApplicationResponse::from)
                .toList();
    }

    private static boolean hasRole(Authentication auth, String role) {
        return auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals(role));
    }
}
