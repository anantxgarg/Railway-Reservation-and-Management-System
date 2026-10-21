package com.railway.booking.booking;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Request and response types for bookings. Requests are only checked for
 * shape here; value rules (age range, gender, class on train, ...) are the
 * database's, so there is one place that decides them.
 */
public final class BookingModels {

    private BookingModels() {
    }

    /** POST /api/bookings. from/to are station codes; quotaCode defaults to GN. */
    public record CreateBookingRequest(@NotNull Integer runId,
                                       @NotBlank String classCode,
                                       String quotaCode,
                                       @NotBlank String from,
                                       @NotBlank String to,
                                       @NotNull @Size(min = 1, max = 6) List<@NotNull @Valid PassengerInput> passengers) {
    }

    public record PassengerInput(@NotNull String name, @NotNull Integer age, @NotNull String gender,
                                 Integer concessionId) {
    }

    /** POST /api/bookings/{pnr}/cancel. No body, or no ids, cancels the whole booking. */
    public record CancelRequest(List<Integer> passengerIds) {
    }

    public record StopRef(int seq, String code, String name) {
    }

    /** One passenger on the PNR status screen. label reads like a ticket: CNF/B1/23/LB, RAC 3, WL 12, CAN. */
    public record PassengerStatus(int passengerId, int passengerNo, String name, int age, String gender,
                                  Integer concessionId, String status, String label, Integer queueNo,
                                  Integer currentPosition, String coachNo, String berthNo, String berthType,
                                  BigDecimal fare, OffsetDateTime cancelledAt) {
    }

    /** A booking with all its passengers (from v_pnr_status). */
    public record BookingDetail(String pnr, int userId, String status, OffsetDateTime holdExpiresAt,
                                OffsetDateTime createdAt, String trainNo, String trainName, int runId,
                                LocalDate runDate, LocalDate journeyDate, String classCode, String className,
                                String quotaCode, StopRef from, StopRef to, BigDecimal totalFare,
                                List<PassengerStatus> passengers) {
    }

    /** A row of "My bookings" (from v_user_bookings). */
    public record BookingSummary(String pnr, String status, String trainNo, String trainName,
                                 LocalDate journeyDate, String fromStation, String toStation, String classCode,
                                 String quotaCode, int passengers, int activePassengers, BigDecimal totalFare,
                                 OffsetDateTime holdExpiresAt, OffsetDateTime createdAt) {
    }

    public record CancelledPassenger(int passengerId, BigDecimal fare, String previousStatus) {
    }

    /**
     * Result of a cancellation. bookingWasPaid tells whether a refund is due;
     * the refund itself is Team 4's (payments).
     */
    public record CancelResult(String pnr, boolean bookingWasPaid, BigDecimal cancelledFare,
                               List<CancelledPassenger> cancelled, BookingDetail booking) {
    }
}
