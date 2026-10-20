package com.railway.booking.booking;

import java.net.URI;
import java.util.List;

import com.railway.booking.booking.BookingModels.BookingDetail;
import com.railway.booking.booking.BookingModels.BookingSummary;
import com.railway.booking.booking.BookingModels.CancelRequest;
import com.railway.booking.booking.BookingModels.CancelResult;
import com.railway.booking.booking.BookingModels.CreateBookingRequest;
import com.railway.booking.security.AuthUser;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Booking endpoints. Roles are enforced in SecurityConfig, ownership in BookingService. */
@RestController
@RequestMapping("/api/bookings")
public class BookingController {

    private final BookingService service;

    public BookingController(BookingService service) {
        this.service = service;
    }

    /** Book and hold seats for 15 minutes awaiting payment. CUSTOMER only. */
    @PostMapping
    public ResponseEntity<BookingDetail> create(@AuthenticationPrincipal AuthUser user,
                                                @Valid @RequestBody CreateBookingRequest request) {
        BookingDetail booking = service.create(user, request);
        return ResponseEntity.created(URI.create("/api/bookings/" + booking.pnr())).body(booking);
    }

    @GetMapping("/mine")
    public List<BookingSummary> mine(@AuthenticationPrincipal AuthUser user) {
        return service.mine(user);
    }

    /** PNR status. The owner, or STAFF/ADMIN. */
    @GetMapping("/{pnr}")
    public BookingDetail get(@AuthenticationPrincipal AuthUser user, @PathVariable String pnr) {
        return service.get(user, pnr);
    }

    /** Cancel the whole booking, or only the listed passengers. The owner, or STAFF/ADMIN. */
    @PostMapping("/{pnr}/cancel")
    public CancelResult cancel(@AuthenticationPrincipal AuthUser user, @PathVariable String pnr,
                               @RequestBody(required = false) CancelRequest request) {
        List<Integer> ids = request == null ? null : request.passengerIds();
        return service.cancel(user, pnr, ids);
    }
}
