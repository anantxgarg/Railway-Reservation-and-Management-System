package com.example.gateway.security;

import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Authenticates "Authorization: Bearer <token>" with a Team 1 token, then
 * checks the account still exists and is ACTIVE and reads its current role
 * from the database, the same steps as Team 1's authenticate middleware.
 *
 * The principal's name is the user id (as before), so controllers keep using
 * auth.getName(). No header: the request continues anonymously and the
 * security rules decide. A bad token is refused with 401.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String USER_SQL = """
            SELECT u.status::TEXT, r.role_name::TEXT
            FROM users u JOIN roles r ON r.role_id = u.role_id
            WHERE u.user_id = ?""";

    private final JwtUtil jwtUtil;
    private final JdbcTemplate jdbc;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        if (!StringUtils.hasText(authHeader)) {
            filterChain.doFilter(request, response);
            return;
        }
        if (!authHeader.startsWith("Bearer ")) {
            reject(response, "Invalid access token");
            return;
        }

        Integer userId;
        try {
            userId = jwtUtil.getUserId(authHeader.substring(7));
        } catch (ExpiredJwtException e) {
            reject(response, "Access token has expired");
            return;
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Invalid JWT token: {}", e.getMessage());
            reject(response, "Invalid access token");
            return;
        }

        List<String[]> rows = jdbc.query(USER_SQL,
                (rs, i) -> new String[] {rs.getString(1), rs.getString(2)}, userId);
        if (rows.isEmpty() || !"ACTIVE".equals(rows.get(0)[0])) {
            reject(response, "Account not found or not active");
            return;
        }

        var authentication = new UsernamePasswordAuthenticationToken(String.valueOf(userId), null,
                List.of(new SimpleGrantedAuthority("ROLE_" + rows.get(0)[1])));
        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(authentication);
        filterChain.doFilter(request, response);
    }

    private static void reject(HttpServletResponse response, String message) throws IOException {
        SecurityContextHolder.clearContext();
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write("{\"error\":\"" + message + "\"}");
    }
}
