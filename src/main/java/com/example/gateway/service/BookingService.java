package com.example.gateway.service;

import com.example.gateway.domain.Booking;
import com.example.gateway.domain.BookingStatus;
import com.example.gateway.repo.BookingRepository;
import com.example.gateway.web.ApiException;
import com.example.gateway.web.Dtos.ConcessionResult;
import com.example.gateway.web.Dtos.CreateBookingRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BookingService {

    private final BookingRepository bookings;
    private final ConcessionService concessions;

    @Transactional
    public Booking create(CreateBookingRequest req) {
        ConcessionResult c = concessions.calculate(req.category(), req.baseFare());

        Booking b = new Booking();
        b.setPassengerName(req.passengerName());
        b.setEmail(req.email());
        b.setPhone(req.phone());
        b.setOrigin(req.origin());
        b.setDestination(req.destination());
        b.setDepartureTime(req.departureTime());
        b.setCategory(req.category());
        b.setBaseFare(req.baseFare());
        b.setConcessionPercent(c.percent());
        b.setConcessionAmount(c.concessionAmount());
        b.setFinalAmount(c.finalAmount());
        b.setStatus(BookingStatus.PENDING_PAYMENT);
        return bookings.save(b);
    }

    public Booking get(Long id) {
        return bookings.findById(id).orElseThrow(() -> ApiException.notFound("Booking not found: " + id));
    }
}
