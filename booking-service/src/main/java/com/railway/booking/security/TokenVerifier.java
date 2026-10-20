package com.railway.booking.security;

import java.nio.charset.StandardCharsets;

import javax.crypto.SecretKey;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.JwtParser;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Verifies access tokens issued by Team 1's backend (backend/src/services/tokenService.js):
 * HS256 only, signed with JWT_SECRET, issuer "railway-api", audience
 * "railway-client", sub = user id.
 */
@Component
public class TokenVerifier {

    static final String ALGORITHM = "HS256";
    static final String ISSUER = "railway-api";
    static final String AUDIENCE = "railway-client";

    /** Why a token was refused; the codes match Team 1's. */
    public enum Failure { INVALID_TOKEN, TOKEN_EXPIRED }

    public static class InvalidTokenException extends Exception {
        private final Failure failure;

        InvalidTokenException(Failure failure) {
            super(failure.name());
            this.failure = failure;
        }

        public Failure failure() {
            return failure;
        }
    }

    private final JwtParser parser;

    public TokenVerifier(@Value("${booking.jwt.secret}") String secret) {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT_SECRET must be set to Team 1's secret (at least 32 bytes)");
        }
        // Team 1 signs with the secret's UTF-8 bytes as the HMAC key
        SecretKey key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.parser = Jwts.parser()
                .verifyWith(key)
                .requireIssuer(ISSUER)
                .requireAudience(AUDIENCE)
                .build();
    }

    /** Returns the user id in the token, or throws if the token is not valid. */
    public int verify(String token) throws InvalidTokenException {
        Jws<Claims> jws;
        try {
            jws = parser.parseSignedClaims(token);
        } catch (ExpiredJwtException e) {
            throw new InvalidTokenException(Failure.TOKEN_EXPIRED);
        } catch (JwtException | IllegalArgumentException e) {
            throw new InvalidTokenException(Failure.INVALID_TOKEN);
        }
        // the key would also verify HS384/HS512; Team 1 pins HS256, so do the same
        if (!ALGORITHM.equals(jws.getHeader().getAlgorithm())) {
            throw new InvalidTokenException(Failure.INVALID_TOKEN);
        }
        try {
            int userId = Integer.parseInt(jws.getPayload().getSubject());
            if (userId > 0) {
                return userId;
            }
        } catch (NumberFormatException e) {
            // fall through
        }
        throw new InvalidTokenException(Failure.INVALID_TOKEN);
    }
}
