package com.example.gateway.web;

import com.example.gateway.domain.PassengerCategory;
import com.example.gateway.service.BookingService;
import com.example.gateway.service.ConcessionService;
import com.example.gateway.web.Dtos.BookingResponse;
import com.example.gateway.web.Dtos.ConcessionResult;
import com.example.gateway.web.Dtos.CreateBookingRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class BookingController {

    private final BookingService bookingService;
    private final ConcessionService concessionService;

    /** Creates a booking with the concession already applied; payable amount = finalAmount. */
    @PostMapping("/bookings")
    @ResponseStatus(HttpStatus.CREATED)
    public BookingResponse create(@Valid @RequestBody CreateBookingRequest req) {
        return BookingResponse.from(bookingService.create(req));
    }

    @GetMapping("/bookings/{id}")
    public BookingResponse get(@PathVariable Long id) {
        return BookingResponse.from(bookingService.get(id));
    }

    /** Lets the UI show the discounted fare before the passenger commits. */
    @GetMapping("/concessions/preview")
    public ConcessionResult preview(
            @RequestParam(required = false, defaultValue = "GENERAL") PassengerCategory category,
            @RequestParam(required = false, defaultValue = "1000.00") BigDecimal baseFare) {
        return concessionService.calculate(category, baseFare);
    }
}
