package com.railway.booking.booking;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import com.railway.booking.booking.BookingModels.BookingDetail;
import com.railway.booking.booking.BookingModels.BookingSummary;
import com.railway.booking.booking.BookingModels.CancelResult;
import com.railway.booking.booking.BookingModels.CancelledPassenger;
import com.railway.booking.booking.BookingModels.CreateBookingRequest;
import com.railway.booking.booking.BookingModels.PassengerInput;
import com.railway.booking.error.ApiException;
import com.railway.booking.network.Journey;
import com.railway.booking.network.NetworkRepository;
import com.railway.booking.security.AuthUser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Who may see or change a booking, plus translating between the API and
 * the database functions. The booking rules themselves are in the database.
 *
 * A customer asking for someone else's PNR gets 404, not 403, so PNRs can't
 * be probed to find out which ones exist.
 */
@Service
public class BookingService {

    private final BookingRepository bookings;
    private final NetworkRepository network;
    private final ObjectMapper json;

    public BookingService(BookingRepository bookings, NetworkRepository network, ObjectMapper json) {
        this.bookings = bookings;
        this.network = network;
        this.json = json;
    }

    @Transactional
    public BookingDetail create(AuthUser user, CreateBookingRequest request) {
        network.findRun(request.runId())
                .orElseThrow(() -> ApiException.notFound("Train run " + request.runId() + " not found"));
        Journey journey = Journey.resolve(network.stopsOfRun(request.runId()), request.from(), request.to());
        String quota = request.quotaCode() == null || request.quotaCode().isBlank() ? "GN" : code(request.quotaCode());

        String pnr = bookings.create(user.userId(), request.runId(), code(request.classCode()), quota,
                journey.from().seq(), journey.to().seq(), passengersJson(request.passengers()));
        return bookings.detail(pnr).orElseThrow();
    }

    @Transactional(readOnly = true)
    public BookingDetail get(AuthUser user, String pnr) {
        BookingDetail booking = bookings.detail(pnr).orElseThrow(() -> notFound(pnr));
        if (booking.userId() != user.userId() && !user.isStaff()) {
            throw notFound(pnr);
        }
        return booking;
    }

    @Transactional(readOnly = true)
    public List<BookingSummary> mine(AuthUser user) {
        return bookings.byUser(user.userId());
    }

    @Transactional
    public CancelResult cancel(AuthUser user, String pnr, List<Integer> passengerIds) {
        int owner = bookings.ownerOf(pnr).orElseThrow(() -> notFound(pnr));
        if (owner != user.userId() && !user.isStaff()) {
            throw notFound(pnr);
        }
        var rows = bookings.cancel(pnr, passengerIds);
        List<CancelledPassenger> cancelled = rows.stream().map(BookingRepository.CancelRow::passenger).toList();
        BigDecimal total = cancelled.stream().map(CancelledPassenger::fare).reduce(BigDecimal.ZERO, BigDecimal::add);
        boolean paid = rows.stream().anyMatch(BookingRepository.CancelRow::bookingWasPaid);
        return new CancelResult(pnr, paid, total, cancelled, bookings.detail(pnr).orElseThrow());
    }

    /** The passengers as the JSON array create_booking expects. */
    private String passengersJson(List<PassengerInput> passengers) {
        List<Map<String, Object>> rows = passengers.stream().map(p -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", p.name().trim());
            row.put("age", p.age());
            row.put("gender", code(p.gender()));
            row.put("concession_id", p.concessionId());
            return row;
        }).toList();
        try {
            return json.writeValueAsString(rows);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String code(String value) {
        return value.trim().toUpperCase(Locale.ROOT);
    }

    private static ApiException notFound(String pnr) {
        return ApiException.notFound("PNR " + pnr + " not found");
    }
}
