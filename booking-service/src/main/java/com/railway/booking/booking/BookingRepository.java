package com.railway.booking.booking;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import com.railway.booking.booking.BookingModels.BookingDetail;
import com.railway.booking.booking.BookingModels.BookingSummary;
import com.railway.booking.booking.BookingModels.CancelledPassenger;
import com.railway.booking.booking.BookingModels.PassengerStatus;
import com.railway.booking.booking.BookingModels.StopRef;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Calls the C3 booking functions and views (database/c3-booking/06_procedures.sql, 07_views.sql). */
@Repository
public class BookingRepository {

    private static final String STATUS_SQL = """
            SELECT * FROM v_pnr_status WHERE pnr = ? ORDER BY passenger_no""";

    private static final String MINE_SQL = """
            SELECT * FROM v_user_bookings WHERE user_id = ? ORDER BY created_at DESC, pnr""";

    private final JdbcTemplate jdbc;

    public BookingRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** create_booking(...): returns the new PNR. passengersJson is a JSON array. */
    public String create(int userId, int runId, String classCode, String quotaCode, int fromSeq, int toSeq,
                         String passengersJson) {
        return jdbc.queryForObject("SELECT create_booking(?, ?, ?, ?, ?, ?, ?::JSONB)", String.class,
                userId, runId, classCode, quotaCode, fromSeq, toSeq, passengersJson);
    }

    /** Who owns a booking and its status, for access checks. */
    public record Ownership(int userId, String status) {
    }

    public Optional<Ownership> ownership(String pnr) {
        return jdbc.query("SELECT user_id, status::TEXT FROM booking WHERE pnr = ?",
                (rs, i) -> new Ownership(rs.getInt(1), rs.getString(2)), pnr).stream().findFirst();
    }

    public Optional<BookingDetail> detail(String pnr) {
        List<PassengerStatus> passengers = new ArrayList<>();
        BookingDetail[] booking = new BookingDetail[1];
        jdbc.query(STATUS_SQL, rs -> {
            if (booking[0] == null) {
                booking[0] = new BookingDetail(rs.getString("pnr"), rs.getInt("user_id"),
                        rs.getString("booking_status"), rs.getObject("hold_expires_at", OffsetDateTime.class),
                        rs.getObject("created_at", OffsetDateTime.class), rs.getString("train_no"),
                        rs.getString("train_name"), rs.getInt("run_id"), rs.getObject("run_date", LocalDate.class),
                        rs.getObject("journey_date", LocalDate.class), rs.getString("class_code"),
                        rs.getString("class_name"), rs.getString("quota_code"),
                        new StopRef(rs.getInt("from_seq"), rs.getString("from_station"),
                                rs.getString("from_station_name")),
                        new StopRef(rs.getInt("to_seq"), rs.getString("to_station"),
                                rs.getString("to_station_name")),
                        rs.getBigDecimal("total_fare"), passengers);
            }
            passengers.add(new PassengerStatus(rs.getInt("passenger_id"), rs.getInt("passenger_no"),
                    rs.getString("name"), rs.getInt("age"), rs.getString("gender"),
                    rs.getObject("concession_id", Integer.class), rs.getString("passenger_status"),
                    rs.getString("status_label"), rs.getObject("queue_no", Integer.class),
                    rs.getObject("current_position", Integer.class), rs.getString("coach_no"),
                    rs.getString("berth_no"), rs.getString("berth_type"), rs.getBigDecimal("passenger_fare"),
                    rs.getObject("cancelled_at", OffsetDateTime.class)));
        }, pnr);
        return Optional.ofNullable(booking[0]);
    }

    public List<BookingSummary> byUser(int userId) {
        return jdbc.query(MINE_SQL, (rs, i) -> new BookingSummary(rs.getString("pnr"), rs.getString("status"),
                rs.getString("train_no"), rs.getString("train_name"), rs.getObject("journey_date", LocalDate.class),
                rs.getString("from_station"), rs.getString("to_station"), rs.getString("class_code"),
                rs.getString("quota_code"), rs.getInt("passengers"), rs.getInt("active_passengers"),
                rs.getBigDecimal("total_fare"), rs.getObject("hold_expires_at", OffsetDateTime.class),
                rs.getObject("created_at", OffsetDateTime.class)), userId);
    }

    /** One row of cancel_passengers(...) plus whether the booking had been paid. */
    public record CancelRow(CancelledPassenger passenger, boolean bookingWasPaid) {
    }

    /** cancel_passengers(pnr, ids); passengerIds null cancels everyone still active. */
    public List<CancelRow> cancel(String pnr, List<Integer> passengerIds) {
        return jdbc.query(con -> {
            var ps = con.prepareStatement("SELECT * FROM cancel_passengers(?, ?)");
            ps.setString(1, pnr);
            if (passengerIds == null) {
                ps.setNull(2, java.sql.Types.ARRAY);
            } else {
                ps.setArray(2, con.createArrayOf("integer", passengerIds.toArray()));
            }
            return ps;
        }, (rs, i) -> new CancelRow(new CancelledPassenger(rs.getInt("passenger_id"),
                rs.getBigDecimal("passenger_fare"), rs.getString("previous_status")),
                rs.getBoolean("booking_was_paid")));
    }

    /** CALL expire_holds(): returns how many bookings expired. */
    public int expireHolds() {
        Integer expired = jdbc.queryForObject("CALL expire_holds()", Integer.class);
        return expired == null ? 0 : expired;
    }

    /** Queues Team 6's BOOKING_CANCELLED for an unpaid booking (no refund); see 08_notifications.sql. */
    public void queueCancelledNotification(String pnr, int cancelledPassengers, String reason) {
        jdbc.queryForObject("""
                SELECT queue_notification('BOOKING_CANCELLED', pnr, 'team-3', jsonb_build_object(
                           'trainNumber', train_no, 'journeyDate', journey_date::TEXT,
                           'cancelledPassengers', ?, 'refundAmount', 0, 'reason', ?))
                FROM v_user_bookings WHERE pnr = ?""", Long.class, cancelledPassengers, reason, pnr);
    }
}
