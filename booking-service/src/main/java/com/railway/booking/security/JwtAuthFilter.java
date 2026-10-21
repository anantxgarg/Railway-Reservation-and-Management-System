package com.railway.booking.security;

import java.io.IOException;
import java.util.List;

import com.railway.booking.error.ErrorResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Reads "Authorization: Bearer <token>", verifies it, and checks that the
 * account still exists and is ACTIVE, the same steps as Team 1's
 * authenticate middleware.
 *
 * No header: the request continues anonymously, and the security rules
 * decide (public endpoints work, the rest get 401). A header with a bad
 * token is refused with 401 straight away.
 */
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final String USER_SQL = """
            SELECT u.status::TEXT, r.role_name::TEXT
            FROM users u JOIN roles r ON r.role_id = u.role_id
            WHERE u.user_id = ?""";

    private final TokenVerifier verifier;
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public JwtAuthFilter(TokenVerifier verifier, JdbcTemplate jdbc, ObjectMapper json) {
        this.verifier = verifier;
        this.jdbc = jdbc;
        this.json = json;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || header.isBlank()) {
            chain.doFilter(request, response);
            return;
        }
        if (!header.startsWith("Bearer ")) {
            reject(response, "INVALID_TOKEN", "Invalid access token");
            return;
        }

        int userId;
        try {
            userId = verifier.verify(header.substring(7));
        } catch (TokenVerifier.InvalidTokenException e) {
            if (e.failure() == TokenVerifier.Failure.TOKEN_EXPIRED) {
                reject(response, "TOKEN_EXPIRED", "Access token has expired");
            } else {
                reject(response, "INVALID_TOKEN", "Invalid access token");
            }
            return;
        }

        List<String[]> rows = jdbc.query(USER_SQL,
                (rs, i) -> new String[] {rs.getString(1), rs.getString(2)}, userId);
        if (rows.isEmpty()) {
            reject(response, "USER_NOT_FOUND", "Authentication required");
            return;
        }
        if (!"ACTIVE".equals(rows.get(0)[0])) {
            reject(response, "ACCOUNT_NOT_ACTIVE", "Account is not active");
            return;
        }

        String role = rows.get(0)[1];
        var auth = new UsernamePasswordAuthenticationToken(new AuthUser(userId, role), null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role)));
        SecurityContextHolder.getContext().setAuthentication(auth);
        chain.doFilter(request, response);
    }

    private void reject(HttpServletResponse response, String code, String message) throws IOException {
        SecurityContextHolder.clearContext();
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        json.writeValue(response.getOutputStream(), ErrorResponse.of(code, message));
    }
}
