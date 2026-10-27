package com.railway.train;

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
 * Base for API tests against the test database built by run_tests.sh. Every
 * test runs in a transaction that is rolled back.
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

    @Value("${train.jwt.secret}")
    private String secret;

    @BeforeEach
    void onlyOnTestDatabase() {
        String db = jdbc.queryForObject("SELECT current_database()", String.class);
        assertThat(db).as("API tests only run on a database whose name ends in _test").endsWith("_test");
    }

    protected int userId(String email) {
        return jdbc.queryForObject("SELECT user_id FROM users WHERE email = ?", Integer.class, email);
    }

    /** "Authorization" header with a token as Team 1's backend issues it. */
    protected String bearer(String email) {
        Instant now = Instant.now();
        String token = Jwts.builder()
                .subject(String.valueOf(userId(email)))
                .issuer("railway-api")
                .audience().add("railway-client").and()
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(900)))
                .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
                .compact();
        return "Bearer " + token;
    }

    protected int runId(String trainNo, LocalDate date) {
        return jdbc.queryForObject("SELECT run_id FROM train_run WHERE train_no = ? AND run_date = ?",
                Integer.class, trainNo, date);
    }

    /** A paid booking for customer@example.com on a run, NDLS (1) -> BCT (4) style: first to last stop. */
    protected String paidBooking(int runId, String classCode) {
        String pnr = jdbc.queryForObject("""
                SELECT create_booking(?, ?, ?, 'GN', 1,
                       (SELECT max(stop_seq) FROM route_station WHERE route_id = route_of_run(?)),
                       '[{"name":"Asha Rao","age":34,"gender":"F"}]')""",
                String.class, userId("customer@example.com"), runId, classCode, runId);
        jdbc.queryForObject("SELECT confirm_booking(?)", Object.class, pnr);
        return pnr;
    }
}
