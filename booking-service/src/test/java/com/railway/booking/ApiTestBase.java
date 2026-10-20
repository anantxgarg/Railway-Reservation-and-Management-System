package com.railway.booking;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Date;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * Base for API tests against the test database. Every test runs in a
 * transaction that is rolled back, so tests don't see each other's bookings.
 *
 * A database error aborts that transaction, so a test that expects one must
 * make it its last database call.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public abstract class ApiTestBase {

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected JdbcTemplate jdbc;

    @Value("${booking.jwt.secret}")
    private String secret;

    @BeforeEach
    void onlyOnTestDatabase() {
        String db = jdbc.queryForObject("SELECT current_database()", String.class);
        assertThat(db).as("API tests only run on a database whose name ends in _test").endsWith("_test");
    }

    protected int userId(String email) {
        return jdbc.queryForObject("SELECT user_id FROM users WHERE email = ?", Integer.class, email);
    }

    /** A token as Team 1's backend issues it. */
    protected String tokenFor(String email) {
        return token(String.valueOf(userId(email)), secret, 15 * 60);
    }

    protected String bearer(String email) {
        return "Bearer " + tokenFor(email);
    }

    protected static String token(String subject, String secret, long secondsValid) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(subject)
                .claim("role", "CUSTOMER")
                .issuer("railway-api")
                .audience().add("railway-client").and()
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(secondsValid)))
                .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
                .compact();
    }

    protected String secret() {
        return secret;
    }

    /** The run of a train a number of days from today. */
    protected int runId(String trainNo, int daysAhead) {
        return jdbc.queryForObject("SELECT run_id FROM train_run WHERE train_no = ? AND run_date = ?",
                Integer.class, trainNo, LocalDate.now().plusDays(daysAhead));
    }

    /** A second active customer, so ownership can be tested. */
    protected String otherCustomer() {
        jdbc.update("""
                INSERT INTO users (role_id, name, email, password_hash)
                SELECT role_id, 'Other Customer', 'other@example.com',
                       (SELECT password_hash FROM users WHERE email = 'customer@example.com')
                FROM roles WHERE role_name = 'CUSTOMER'""");
        return "other@example.com";
    }
}
