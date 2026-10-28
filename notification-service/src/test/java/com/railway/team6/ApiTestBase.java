package com.railway.team6;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/*
 * Base for the API tests. Needs a MongoDB (TEAM6_TEST_MONGO_URI, default localhost:27017);
 * the test database is emptied before every test.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class ApiTestBase {

    protected static final String KEY = "test-internal-key";

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected MongoTemplate mongo;

    @Value("${team6.jwt.secret}")
    private String secret;

    @BeforeEach
    void emptyTestDatabase() {
        assertThat(mongo.getDb().getName()).as("tests only run on a database whose name ends in _test").endsWith("_test");
        mongo.getDb().drop();
    }

    /* "Authorization" header value, with a token like the ones Team 1's backend gives out. */
    protected String bearer(String userId, String role) {
        Instant now = Instant.now();
        return "Bearer " + Jwts.builder()
                .subject(userId)
                .claim("role", role)
                .issuer("railway-api")
                .audience().add("railway-client").and()
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(900)))
                .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
                .compact();
    }

    /* A JOURNEY_COMPLETED notification as booking-service delivers it (opens the feedback form). */
    protected static String journeyCompleted(String userId, String pnr) {
        return """
                {"type":"JOURNEY_COMPLETED","userId":"%s","pnr":"%s","sourceTeam":"team-2",
                 "eventTime":"2026-10-21T14:30:00",
                 "data":{"trainNumber":"12952","trainName":"Mumbai Rajdhani Express","journeyDate":"2026-10-20",
                         "fromStation":"NDLS","toStation":"BCT","departureTime":"16:55","arrivalTime":"08:25",
                         "passengerName":"Asha Rao","coach":"A1","seat":"23"}}""".formatted(userId, pnr);
    }
}
