package com.example.gateway.security;

import io.jsonwebtoken.JwtBuilder;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** Tokens are Team 1's: HS256, issuer railway-api, audience railway-client, sub = user id. */
class JwtUtilTest {

    // 64+ bytes, so an HS512 token can be made with it for the algorithm test
    private static final String SECRET = "SecretKeyForRailwayUnitTestingMustBeAtLeast32BytesLong!-and-then-some-more";

    private final JwtUtil jwtUtil = new JwtUtil(SECRET);

    private static JwtBuilder team1Token() {
        Instant now = Instant.now();
        return Jwts.builder().subject("42").claim("role", "CUSTOMER")
                .issuer("railway-api").audience().add("railway-client").and()
                .issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(900)));
    }

    private static String sign(JwtBuilder jwt) {
        return jwt.signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256).compact();
    }

    @Test
    void acceptsTeam1Tokens() {
        assertEquals(42, jwtUtil.getUserId(sign(team1Token())));
    }

    @Test
    void rejectsWrongIssuerAudienceOrExpiry() {
        assertThrows(JwtException.class, () -> jwtUtil.getUserId(sign(team1Token().issuer("module4"))));
        assertThrows(JwtException.class, () -> jwtUtil.getUserId(sign(team1Token().audience().single("other"))));
        assertThrows(JwtException.class, () -> jwtUtil.getUserId(
                sign(team1Token().expiration(Date.from(Instant.now().minusSeconds(60))))));
    }

    @Test
    void rejectsOtherAlgorithmsAndUnsignedTokens() {
        String hs512 = team1Token()
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS512).compact();
        assertThrows(JwtException.class, () -> jwtUtil.getUserId(hs512));
        assertThrows(JwtException.class, () -> jwtUtil.getUserId(team1Token().compact()));
    }

    @Test
    void rejectsSubjectsThatAreNotUserIds() {
        assertThrows(JwtException.class, () -> jwtUtil.getUserId(sign(team1Token().subject("abc"))));
    }

    @Test
    void refusesToStartWithoutAProperSecret() {
        assertThrows(IllegalStateException.class, () -> new JwtUtil("short"));
        assertThrows(IllegalStateException.class, () -> new JwtUtil(null));
    }
}
