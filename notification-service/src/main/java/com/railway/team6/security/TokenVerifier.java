package com.railway.team6.security;

import java.nio.charset.StandardCharsets;

import javax.crypto.SecretKey;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.JwtParser;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/*
 * Checks the access tokens Team 1's backend gives out at login
 * (backend/src/services/tokenService.js): HS256, signed with JWT_SECRET,
 * issuer "railway-api", audience "railway-client", sub = user id, role = CUSTOMER/STAFF/ADMIN.
 *
 * booking-service also looks the user up in PostgreSQL; we have no PostgreSQL, so we trust
 * the role inside the token. A token lasts 15 minutes, so a role change takes at most that long.
 */
@Component
public class TokenVerifier {

    public static class InvalidTokenException extends Exception {
        private final boolean expired;

        InvalidTokenException(boolean expired) {
            super(expired ? "TOKEN_EXPIRED" : "INVALID_TOKEN");
            this.expired = expired;
        }

        public boolean expired() {
            return expired;
        }
    }

    private final JwtParser parser;

    public TokenVerifier(@Value("${team6.jwt.secret}") String secret) {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT_SECRET must be set to Team 1's secret (at least 32 bytes)");
        }
        SecretKey key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.parser = Jwts.parser().verifyWith(key).requireIssuer("railway-api").requireAudience("railway-client").build();
    }

    public Caller verify(String token) throws InvalidTokenException {
        Jws<Claims> jws;
        try {
            jws = parser.parseSignedClaims(token);
        } catch (ExpiredJwtException e) {
            throw new InvalidTokenException(true);
        } catch (JwtException | IllegalArgumentException e) {
            throw new InvalidTokenException(false);
        }
        // Team 1 only signs with HS256, so refuse anything else
        if (!"HS256".equals(jws.getHeader().getAlgorithm())) {
            throw new InvalidTokenException(false);
        }
        String userId = jws.getPayload().getSubject();
        Object role = jws.getPayload().get("role");
        if (userId == null || !userId.matches("[1-9]\\d*")
                || !(role instanceof String r && r.matches("CUSTOMER|STAFF|ADMIN"))) {
            throw new InvalidTokenException(false);
        }
        return new Caller(userId, (String) role);
    }
}
