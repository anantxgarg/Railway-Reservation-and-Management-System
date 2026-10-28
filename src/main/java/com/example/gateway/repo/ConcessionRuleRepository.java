package com.example.gateway.repo;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

/**
 * The concessions and their discounts, from the shared concession_rule table
 * (database/c3-booking/02_quota_concession.sql). Team 3's calc_fare applies the
 * same rows when a passenger is booked with a concession, so the preview, the
 * booking and the staff verification all use one set of numbers.
 */
@Repository
@RequiredArgsConstructor
public class ConcessionRuleRepository {

    /** discountType is PERCENTAGE (discountValue is a percent) or FIXED_AMOUNT (rupees). */
    public record Rule(int concessionId, String category, String name, String eligibility,
                       String discountType, BigDecimal discountValue, Integer minAge, Integer maxAge,
                       String description) {

        public boolean isPercentage() {
            return "PERCENTAGE".equals(discountType);
        }
    }

    /** A passenger booked with a concession: the rule, and the fare with and without it. */
    public record PassengerConcession(Rule rule, BigDecimal fare, BigDecimal fareWithoutConcession) {
    }

    private static final String SELECT_RULE = """
            SELECT r.concession_id, r.category, r.concession_name, r.eligibility_rule, r.discount_type,
                   r.discount_value, r.min_age, r.max_age, r.description
            FROM concession_rule r""";

    private final JdbcTemplate jdbc;

    /** Rules that can be used for new bookings. */
    public List<Rule> active() {
        return jdbc.query(SELECT_RULE + " WHERE r.is_active ORDER BY r.concession_id", ConcessionRuleRepository::rule);
    }

    public Optional<Rule> byCategory(String category) {
        return jdbc.query(SELECT_RULE + " WHERE r.category = ? AND r.is_active", ConcessionRuleRepository::rule, category)
                .stream().findFirst();
    }

    /** The concession a passenger was booked with; empty when they were booked without one. */
    public Optional<PassengerConcession> ofPassenger(int passengerId) {
        // the fare without it is Team 3's calc_fare for the same journey, minus the concession
        return jdbc.query("""
                SELECT r.concession_id, r.category, r.concession_name, r.eligibility_rule, r.discount_type,
                       r.discount_value, r.min_age, r.max_age, r.description, p.passenger_fare,
                       calc_fare(b.run_id, b.class_code, b.quota_code, b.from_seq, b.to_seq) AS full_fare
                FROM passenger p
                JOIN booking b ON b.pnr = p.pnr
                JOIN concession_rule r ON r.concession_id = p.concession_id
                WHERE p.passenger_id = ?""",
                (rs, i) -> new PassengerConcession(rule(rs, i), rs.getBigDecimal("passenger_fare"),
                        rs.getBigDecimal("full_fare")),
                passengerId).stream().findFirst();
    }

    private static Rule rule(ResultSet rs, int row) throws SQLException {
        return new Rule(rs.getInt("concession_id"), rs.getString("category"), rs.getString("concession_name"),
                rs.getString("eligibility_rule"), rs.getString("discount_type"), rs.getBigDecimal("discount_value"),
                rs.getObject("min_age", Integer.class), rs.getObject("max_age", Integer.class),
                rs.getString("description"));
    }
}
