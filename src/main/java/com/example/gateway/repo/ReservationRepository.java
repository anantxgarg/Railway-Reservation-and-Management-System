package com.example.gateway.repo;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Bookings belong to Team 3 (database/c3-booking). This reads them and calls
 * Team 3's database functions with plain SQL, inside the caller's transaction,
 * so a payment or refund and the booking change commit or roll back together.
 */
@Repository
@RequiredArgsConstructor
public class ReservationRepository {

    /**
     * A booking as payments see it. totalFare is the amount to pay while HELD
     * and the amount paid once CONFIRMED. holdActive is false once the 15-minute
     * payment hold has run out (checked against the database clock). departsAt
     * is when the train leaves the passenger's boarding station, by Team 2's
     * timetable (C2 stop_departure_at).
     */
    public record Reservation(String pnr, int userId, String status, BigDecimal totalFare,
                              boolean holdActive, LocalDate journeyDate, Instant departsAt) {
    }

    public record PassengerInfo(int passengerId, String name, BigDecimal fare, String status) {
    }

    public record CancelledPassenger(int passengerId, BigDecimal fare, String previousStatus) {
    }

    private static final String SELECT_BOOKING = """
            SELECT pnr, user_id, status::TEXT AS status, total_fare,
                   coalesce(hold_expires_at > now(), FALSE) AS hold_active,
                   journey_date(run_id, from_seq) AS journey_date,
                   stop_departure_at(run_id, from_seq) AS departs_at
            FROM booking WHERE pnr = ?""";

    private final JdbcTemplate jdbc;

    public Optional<Reservation> find(String pnr) {
        return jdbc.query(SELECT_BOOKING, ReservationRepository::reservation, pnr).stream().findFirst();
    }

    /** Same as find, and locks the booking row until the transaction ends. */
    public Optional<Reservation> lock(String pnr) {
        return jdbc.query(SELECT_BOOKING + " FOR UPDATE OF booking", ReservationRepository::reservation, pnr)
                .stream().findFirst();
    }

    /** confirm_booking(pnr): HELD -> CONFIRMED. Returns the amount the booking costs. */
    public BigDecimal confirm(String pnr) {
        return jdbc.queryForObject("SELECT confirm_booking(?)", BigDecimal.class, pnr);
    }

    /** cancel_passengers(pnr, ids): frees their seats and moves the queue up. ids null means everyone left. */
    public List<CancelledPassenger> cancel(String pnr, List<Integer> passengerIds) {
        return jdbc.query(con -> {
            var ps = con.prepareStatement(
                    "SELECT passenger_id, passenger_fare, previous_status::TEXT FROM cancel_passengers(?, ?)");
            ps.setString(1, pnr);
            if (passengerIds == null) {
                ps.setNull(2, Types.ARRAY);
            } else {
                ps.setArray(2, con.createArrayOf("integer", passengerIds.toArray()));
            }
            return ps;
        }, (rs, i) -> new CancelledPassenger(rs.getInt(1), rs.getBigDecimal(2), rs.getString(3)));
    }

    /** Passengers not yet cancelled, in booking order. */
    public List<PassengerInfo> activePassengers(String pnr) {
        return jdbc.query("""
                SELECT passenger_id, name, passenger_fare, status::TEXT FROM passenger
                WHERE pnr = ? AND status <> 'CANCELLED' ORDER BY passenger_id""",
                ReservationRepository::passenger, pnr);
    }

    public Optional<PassengerInfo> passenger(String pnr, int passengerId) {
        return jdbc.query("""
                SELECT passenger_id, name, passenger_fare, status::TEXT FROM passenger
                WHERE pnr = ? AND passenger_id = ?""",
                ReservationRepository::passenger, pnr, passengerId).stream().findFirst();
    }

    /*
     * Team 6 notifications. They go to Team 3's notification_outbox table in the
     * caller's transaction (database/c3-booking/08_notifications.sql), so they
     * exist only if the payment or refund commits; booking-service delivers them.
     */

    /** PAYMENT_CONFIRMED for the booking's owner. paidAt is shown in Indian time. */
    public void notifyPaymentConfirmed(String pnr, String razorpayPaymentId, String razorpayOrderId, BigDecimal amount) {
        jdbc.queryForObject("""
                SELECT queue_notification('PAYMENT_CONFIRMED', ?, 'team-4', jsonb_build_object(
                           'razorpayPaymentId', ?::TEXT, 'razorpayOrderId', ?::TEXT, 'amount', ?::NUMERIC,
                           'paidAt', to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS')))""",
                Long.class, pnr, razorpayPaymentId, razorpayOrderId, amount);
    }

    /** BOOKING_CANCELLED for passengers of a paid booking, with what is refunded. */
    public void notifyCancelled(String pnr, int cancelledPassengers, BigDecimal refundAmount, String reason) {
        jdbc.queryForObject("""
                SELECT queue_notification('BOOKING_CANCELLED', pnr, 'team-4', jsonb_build_object(
                           'trainNumber', train_no, 'journeyDate', journey_date::TEXT,
                           'cancelledPassengers', ?::INTEGER, 'refundAmount', ?::NUMERIC, 'reason', ?::TEXT))
                FROM v_user_bookings WHERE pnr = ?""",
                Long.class, cancelledPassengers, refundAmount, reason, pnr);
    }

    private static Reservation reservation(ResultSet rs, int row) throws SQLException {
        return new Reservation(rs.getString("pnr"), rs.getInt("user_id"), rs.getString("status"),
                rs.getBigDecimal("total_fare"), rs.getBoolean("hold_active"),
                rs.getObject("journey_date", LocalDate.class),
                rs.getObject("departs_at", OffsetDateTime.class) == null ? null
                        : rs.getObject("departs_at", OffsetDateTime.class).toInstant());
    }

    private static PassengerInfo passenger(ResultSet rs, int row) throws SQLException {
        return new PassengerInfo(rs.getInt(1), rs.getString(2), rs.getBigDecimal(3), rs.getString(4));
    }
}
