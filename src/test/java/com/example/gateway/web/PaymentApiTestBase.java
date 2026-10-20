package com.example.gateway.web;

import com.razorpay.Order;
import com.razorpay.OrderClient;
import com.razorpay.PaymentClient;
import com.razorpay.RazorpayClient;
import com.razorpay.Refund;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.persistence.EntityManager;
import org.json.JSONObject;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Date;
import java.util.HexFormat;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Integration tests against the shared test database (C1 + C3 tables built by
 * database/setup.sh, this app's tables by Flyway). Razorpay is replaced by a
 * mock, so nothing leaves the machine. Each test runs in a transaction that is
 * rolled back.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public abstract class PaymentApiTestBase {

    protected static final String CUSTOMER = "customer@example.com";

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected JdbcTemplate jdbc;

    @Autowired
    private EntityManager entityManager;

    @MockBean
    protected RazorpayClient razorpay;

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${razorpay.key-secret}")
    private String keySecret;

    @Value("${razorpay.webhook-secret}")
    private String webhookSecret;

    @BeforeEach
    void setUpRazorpayAndCheckDatabase() throws Exception {
        String db = jdbc.queryForObject("SELECT current_database()", String.class);
        assertThat(db).as("integration tests only run on a database whose name ends in _test").endsWith("_test");

        razorpay.orders = mock(OrderClient.class);
        razorpay.payments = mock(PaymentClient.class);
        when(razorpay.orders.create(any())).thenAnswer(inv ->
                new Order(new JSONObject().put("id", "order_" + UUID.randomUUID().toString().substring(0, 12))));
        when(razorpay.payments.refund(anyString(), any())).thenAnswer(inv ->
                new Refund(new JSONObject().put("id", "rfnd_" + UUID.randomUUID().toString().substring(0, 12))
                        .put("status", "processed")));
    }

    /**
     * Reads a value straight from the database. Hibernate writes its changes at
     * commit, and the test transaction never commits, so flush them first.
     */
    protected <T> T dbValue(String sql, Class<T> type, Object... args) {
        entityManager.flush();
        return jdbc.queryForObject(sql, type, args);
    }

    protected int userId(String email) {
        return jdbc.queryForObject("SELECT user_id FROM users WHERE email = ?", Integer.class, email);
    }

    /** "Bearer <token>" as Team 1's login issues it. */
    protected String bearer(String email) {
        Instant now = Instant.now();
        return "Bearer " + Jwts.builder()
                .subject(String.valueOf(userId(email)))
                .claim("role", "CUSTOMER")
                .issuer("railway-api")
                .audience().add("railway-client").and()
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(900)))
                .signWith(Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
                .compact();
    }

    /** A HELD booking made with Team 3's create_booking, on the Pune intercity some days ahead. */
    protected String book(String email, int passengers, int daysAhead) {
        int run = jdbc.queryForObject("SELECT run_id FROM train_run WHERE train_no = '12127' AND run_date = ?",
                Integer.class, LocalDate.now().plusDays(daysAhead));
        return jdbc.queryForObject("""
                SELECT create_booking(?, ?, '2S', 'GN', 1, 2,
                    (SELECT jsonb_agg(jsonb_build_object('name', 'Passenger ' || i, 'age', 30, 'gender', 'M'))
                     FROM generate_series(1, ?) i))""",
                String.class, userId(email), run, passengers);
    }

    protected BigDecimal totalFare(String pnr) {
        return jdbc.queryForObject("SELECT total_fare FROM booking WHERE pnr = ?", BigDecimal.class, pnr);
    }

    protected String bookingStatus(String pnr) {
        return jdbc.queryForObject("SELECT status::TEXT FROM booking WHERE pnr = ?", String.class, pnr);
    }

    protected int passengerId(String pnr, int n) {
        return jdbc.queryForObject("SELECT passenger_id FROM passenger WHERE pnr = ? ORDER BY passenger_id OFFSET ? LIMIT 1",
                Integer.class, pnr, n - 1);
    }

    /** The checkout signature Razorpay sends to the browser: HMAC-SHA256(order|payment, key secret). */
    protected String checkoutSignature(String orderId, String paymentId) {
        return hmac(orderId + "|" + paymentId, keySecret);
    }

    protected String webhookSignature(String payload) {
        return hmac(payload, webhookSecret);
    }

    private static String hmac(String data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
