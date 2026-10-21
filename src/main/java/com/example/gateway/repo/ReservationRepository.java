package com.example.gateway.repo;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.LocalDate;
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
     * payment hold has run out (checked against the database clock).
     */
    public record Reservation(String pnr, int userId, String status, BigDecimal totalFare,
                              boolean holdActive, LocalDate journeyDate) {
    }

    public record PassengerInfo(int passengerId, String name, BigDecimal fare, String status) {
    }

    public record CancelledPassenger(int passengerId, BigDecimal fare, String previousStatus) {
    }

    private static final String SELECT_BOOKING = """
            SELECT pnr, user_id, status::TEXT AS status, total_fare,
                   coalesce(hold_expires_at > now(), FALSE) AS hold_active,
                   journey_date(run_id, from_seq) AS journey_date
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

    private static Reservation reservation(ResultSet rs, int row) throws SQLException {
        return new Reservation(rs.getString("pnr"), rs.getInt("user_id"), rs.getString("status"),
                rs.getBigDecimal("total_fare"), rs.getBoolean("hold_active"),
                rs.getObject("journey_date", LocalDate.class));
    }

    private static PassengerInfo passenger(ResultSet rs, int row) throws SQLException {
        return new PassengerInfo(rs.getInt(1), rs.getString(2), rs.getBigDecimal(3), rs.getString(4));
    }
}
