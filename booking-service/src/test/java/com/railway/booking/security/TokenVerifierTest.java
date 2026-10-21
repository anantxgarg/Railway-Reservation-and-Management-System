package com.railway.booking.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

import io.jsonwebtoken.JwtBuilder;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

/** Token rules, without a database: the same checks as Team 1's verifyAccessToken. */
class TokenVerifierTest {

    // 64+ bytes, so an HS512 token can be made with it for the algorithm test
    private static final String SECRET = "unit-test-secret-unit-test-secret-unit-test-secret-unit-test-secret";
    private final TokenVerifier verifier = new TokenVerifier(SECRET);

    private static JwtBuilder valid() {
        Instant now = Instant.now();
        return Jwts.builder().subject("7").claim("role", "CUSTOMER")
                .issuer("railway-api").audience().add("railway-client").and()
                .issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(600)));
    }

    private static String sign(JwtBuilder jwt) {
        return jwt.signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256).compact();
    }

    private TokenVerifier.Failure failureOf(String token) {
        try {
            verifier.verify(token);
        } catch (TokenVerifier.InvalidTokenException e) {
            return e.failure();
        }
        return null;
    }

    @Test
    void acceptsTeam1Token() throws Exception {
        assertThat(verifier.verify(sign(valid()))).isEqualTo(7);
    }

    @Test
    void rejectsExpiredToken() {
        Instant past = Instant.now().minusSeconds(120);
        assertThat(failureOf(sign(valid().expiration(Date.from(past)))))
                .isEqualTo(TokenVerifier.Failure.TOKEN_EXPIRED);
    }

    @Test
    void rejectsWrongSecret() {
        String other = valid().signWith(Keys.hmacShaKeyFor(
                "another-secret-another-secret-another-secret".getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
                .compact();
        assertThat(failureOf(other)).isEqualTo(TokenVerifier.Failure.INVALID_TOKEN);
    }

    @Test
    void rejectsWrongIssuerOrAudience() {
        assertThat(failureOf(sign(valid().issuer("someone-else")))).isEqualTo(TokenVerifier.Failure.INVALID_TOKEN);
        assertThat(failureOf(sign(valid().audience().single("other-client")))).isEqualTo(TokenVerifier.Failure.INVALID_TOKEN);
    }

    @Test
    void rejectsOtherAlgorithmsEvenWithTheRightSecret() {
        String hs512 = valid().signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS512)
                .compact();
        assertThat(failureOf(hs512)).isEqualTo(TokenVerifier.Failure.INVALID_TOKEN);
    }

    @Test
    void rejectsUnsignedToken() {
        assertThat(failureOf(valid().compact())).isEqualTo(TokenVerifier.Failure.INVALID_TOKEN);
    }

    @Test
    void rejectsBadSubject() {
        assertThat(failureOf(sign(valid().subject("abc")))).isEqualTo(TokenVerifier.Failure.INVALID_TOKEN);
        assertThat(failureOf(sign(valid().subject("0")))).isEqualTo(TokenVerifier.Failure.INVALID_TOKEN);
    }

    @Test
    void refusesToStartWithoutAProperSecret() {
        assertThatThrownBy(() -> new TokenVerifier("short")).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new TokenVerifier(null)).isInstanceOf(IllegalStateException.class);
    }
}
