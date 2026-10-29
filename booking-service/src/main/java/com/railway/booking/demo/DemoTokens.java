package com.railway.booking.demo;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import javax.crypto.SecretKey;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * DEMO MODE ONLY, stand-in for Team 1's tokenService.js.
 *
 * Access tokens are made exactly as Team 1 makes them, so TokenVerifier
 * accepts them: HS256 with JWT_SECRET's UTF-8 bytes, sub = user id, a role
 * claim, issuer "railway-api", audience "railway-client", 15 minutes.
 *
 * Refresh tokens are opaque random hex strings like Team 1's, rotated on
 * every use and revoked on logout, but kept in memory rather than in a
 * table: restarting the service logs everybody out, which is fine for a demo.
 */
@Component
@ConditionalOnProperty(name = "booking.demo.enabled", havingValue = "true")
public class DemoTokens {

    /** Why a refresh token was refused. */
    public enum RefreshFailure { INVALID, EXPIRED }

    /** The outcome of using a refresh token: the user it belonged to, or why it was refused. */
    public record Refreshed(Integer userId, RefreshFailure failure) {
    }

    private record Entry(int userId, Instant expiresAt) {
    }

    private static final SecureRandom RANDOM = new SecureRandom();

    private final SecretKey key;
    private final Duration accessTtl;
    private final Duration refreshTtl;
    private final Map<String, Entry> refreshTokens = new ConcurrentHashMap<>();

    public DemoTokens(@Value("${booking.jwt.secret}") String secret,
                      @Value("${booking.demo.access-token-ttl:15m}") Duration accessTtl,
                      @Value("${booking.demo.refresh-token-ttl:7d}") Duration refreshTtl) {
        // TokenVerifier has already refused a missing or short secret
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTtl = accessTtl;
        this.refreshTtl = refreshTtl;
    }

    public String accessToken(int userId, String role) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("role", role)
                .issuer("railway-api")
                .audience().add("railway-client").and()
                .issuedAt(java.util.Date.from(now))
                .expiration(java.util.Date.from(now.plus(accessTtl)))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    public String issueRefreshToken(int userId) {
        byte[] bytes = new byte[64];
        RANDOM.nextBytes(bytes);
        String raw = HexFormat.of().formatHex(bytes);
        refreshTokens.put(raw, new Entry(userId, Instant.now().plus(refreshTtl)));
        return raw;
    }

    /** Uses up a refresh token (each one works once). The caller issues the successor. */
    public Refreshed consumeRefreshToken(String raw) {
        Entry entry = refreshTokens.remove(raw);
        if (entry == null) {
            return new Refreshed(null, RefreshFailure.INVALID);
        }
        if (entry.expiresAt().isBefore(Instant.now())) {
            return new Refreshed(null, RefreshFailure.EXPIRED);
        }
        return new Refreshed(entry.userId(), null);
    }

    /** Logout: every refresh token of the user stops working. */
    public void revokeAll(int userId) {
        refreshTokens.values().removeIf(e -> e.userId() == userId);
    }
}
