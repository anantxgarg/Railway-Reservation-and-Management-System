package com.example.gateway.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.JwtParser;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

/**
 * Verifies access tokens issued by Team 1's login (backend/src/services/tokenService.js):
 * HS256 only, signed with JWT_SECRET, issuer "railway-api", audience "railway-client",
 * sub = user id. This app no longer issues tokens of its own.
 */
@Component
public class JwtUtil {

    static final String ALGORITHM = "HS256";
    static final String ISSUER = "railway-api";
    static final String AUDIENCE = "railway-client";

    private final JwtParser parser;

    public JwtUtil(@Value("${jwt.secret}") String secret) {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT_SECRET must be set to Team 1's secret (at least 32 bytes)");
        }
        this.parser = Jwts.parser()
                .verifyWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)))
                .requireIssuer(ISSUER)
                .requireAudience(AUDIENCE)
                .build();
    }

    /** Returns the token's claims, or throws JwtException if the token is not valid. */
    public Claims validateAndGetClaims(String token) {
        Jws<Claims> jws = parser.parseSignedClaims(token);
        // the key would also verify HS384/HS512; Team 1 pins HS256, so do the same
        if (!ALGORITHM.equals(jws.getHeader().getAlgorithm())) {
            throw new JwtException("Unexpected algorithm " + jws.getHeader().getAlgorithm());
        }
        return jws.getPayload();
    }

    /** The user id in a valid token. */
    public Integer getUserId(String token) {
        try {
            int id = Integer.parseInt(validateAndGetClaims(token).getSubject());
            if (id > 0) {
                return id;
            }
        } catch (NumberFormatException e) {
            // fall through
        }
        throw new JwtException("Token subject is not a user id");
    }
}
