package com.railway.team6.security;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/*
 * Runs before every request and works out who is calling:
 *
 *   "Authorization: Bearer <token>"  -> a user logged in through Team 1. Their id and role become
 *                                       the Caller, and Spring knows their role (ROLE_CUSTOMER, ...).
 *   "X-Internal-Key: <key>"          -> another team's backend (booking-service) sending a
 *                                       notification. Gets the role ROLE_SERVICE.
 *   nothing                          -> anonymous; SecurityConfig decides what that may do.
 *
 * A bad or expired token is refused straight away with 401, with the same codes as Team 1
 * (TOKEN_EXPIRED makes the frontend refresh the login and try again).
 */
public class JwtAuthFilter extends OncePerRequestFilter {

    private final TokenVerifier verifier;
    private final String internalKey;
    private final ObjectMapper json;

    public JwtAuthFilter(TokenVerifier verifier, String internalKey, ObjectMapper json) {
        this.verifier = verifier;
        this.internalKey = internalKey;
        this.json = json;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String key = request.getHeader("X-Internal-Key");
        if (key != null && !internalKey.isEmpty()) {
            if (!internalKey.equals(key)) {
                reject(response, "INVALID_KEY", "Invalid internal key");
                return;
            }
            SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                    "service", null, List.of(new SimpleGrantedAuthority("ROLE_SERVICE"))));
            chain.doFilter(request, response);
            return;
        }

        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || header.isBlank()) {
            chain.doFilter(request, response);
            return;
        }
        if (!header.startsWith("Bearer ")) {
            reject(response, "INVALID_TOKEN", "Invalid access token");
            return;
        }
        Caller caller;
        try {
            caller = verifier.verify(header.substring(7));
        } catch (TokenVerifier.InvalidTokenException e) {
            reject(response, e.expired() ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
                    e.expired() ? "Access token has expired" : "Invalid access token");
            return;
        }
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                caller, null, List.of(new SimpleGrantedAuthority("ROLE_" + caller.role()))));
        chain.doFilter(request, response);
    }

    // Same error shape as Team 1 and booking-service: {"error": {"code": ..., "message": ...}}
    private void reject(HttpServletResponse response, String code, String message) throws IOException {
        SecurityContextHolder.clearContext();
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        json.writeValue(response.getOutputStream(), Map.of("error", Map.of("code", code, "message", message)));
    }
}
