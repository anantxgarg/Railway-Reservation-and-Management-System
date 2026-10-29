package com.railway.booking.demo;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

import com.railway.booking.security.AuthUser;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * DEMO MODE ONLY: a stand-in for Team 1's /api/auth endpoints
 * (backend/src/controllers/authController.js), so the frontend can log in
 * without Team 1's backend. Requests, responses and error bodies match
 * Team 1's:
 *
 * <pre>
 * POST /api/auth/login   {"email","password"}  -> 200 {"message","token","refreshToken","user":{"userId","name","email","role"}}
 * POST /api/auth/refresh {"refreshToken"}       -> 200 {"token","refreshToken"}
 * POST /api/auth/logout  (Bearer token)         -> 200 {"message"}
 * GET  /api/auth/me      (Bearer token)         -> 200 {"userId","name","email","phone","role","status","createdAt","lastLoginAt"}
 * </pre>
 *
 * Passwords are checked against the bcrypt hash in C1's users table, and
 * only ACTIVE accounts may log in. Unlike Team 1 it does not count failed
 * attempts or lock accounts, and it writes no audit log.
 */
@RestController
@RequestMapping("/api/auth")
@ConditionalOnProperty(name = "booking.demo.enabled", havingValue = "true")
public class DemoAuthController {

    private static final String ACCOUNT_SQL = """
            SELECT u.user_id, u.name, u.email, u.phone, u.password_hash, u.status::TEXT AS status,
                   r.role_name::TEXT AS role, u.created_at, u.last_login_at
            FROM users u JOIN roles r ON r.role_id = u.role_id
            WHERE\s""";

    // Team 1's DUMMY_HASH: checked when the e-mail is unknown, so the answer takes as long either way
    private static final String DUMMY_HASH = "$2b$12$IrZjxD4X72slxHVXvpLfv.VuqN4nfCBIVNpsVS2bcxHLO9iFD/DaG";

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private static final Map<String, String> NOT_ACTIVE_MESSAGES = Map.of(
            "LOCKED", "Your account has been locked due to multiple failed login attempts. Contact support.",
            "SUSPENDED", "Your account has been suspended. Contact support.",
            "INACTIVE", "Your account is inactive. Contact support.",
            "PENDING", "Your account is pending verification. Please verify your email.");

    private record Account(int userId, String name, String email, String phone, String passwordHash,
                           String status, String role, LocalDateTime createdAt, LocalDateTime lastLoginAt) {
    }

    private final JdbcTemplate jdbc;
    private final DemoTokens tokens;
    private final BCryptPasswordEncoder bcrypt = new BCryptPasswordEncoder();

    public DemoAuthController(JdbcTemplate jdbc, DemoTokens tokens) {
        this.jdbc = jdbc;
        this.tokens = tokens;
    }

    @PostMapping("/login")
    public ResponseEntity<Object> login(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> request = body == null ? Map.of() : body;
        List<Map<String, String>> fields = new ArrayList<>();
        String email = null;
        if (!(request.get("email") instanceof String e)) {
            fields.add(field("email", "email must be a string"));
        } else {
            email = e.trim().toLowerCase(Locale.ROOT); // Team 1 normalises the same way
            if (email.length() > 255) {
                fields.add(field("email", "email must be at most 255 characters"));
            } else if (!EMAIL.matcher(email).matches()) {
                fields.add(field("email", "email must be a valid email address"));
            }
        }
        String password = null;
        if (!(request.get("password") instanceof String p)) {
            fields.add(field("password", "password must be a string"));
        } else if (p.isEmpty()) {
            fields.add(field("password", "password is required"));
        } else if (p.length() > 1024) {
            fields.add(field("password", "password is too long"));
        } else {
            password = p;
        }
        if (!fields.isEmpty()) {
            return validationError(fields);
        }

        Optional<Account> found = account("u.email = ?", email);
        // bcrypt only reads 72 bytes; a longer password can't be the right one
        boolean matches = password.getBytes(StandardCharsets.UTF_8).length <= 72
                && bcrypt.matches(password, found.map(Account::passwordHash).orElse(DUMMY_HASH));
        if (found.isEmpty() || !matches) {
            return error(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid email or password");
        }
        Account user = found.get();
        if (!"ACTIVE".equals(user.status())) {
            return error(HttpStatus.FORBIDDEN, "ACCOUNT_NOT_ACTIVE",
                    NOT_ACTIVE_MESSAGES.getOrDefault(user.status(), "Your account cannot log in."));
        }
        // as Team 1: record the login; matching only ACTIVE rows is a last-moment status check
        int recorded = jdbc.update("""
                UPDATE users SET last_login_at = now(), failed_login_attempts = 0
                WHERE user_id = ? AND status = 'ACTIVE'""", user.userId());
        if (recorded == 0) {
            return error(HttpStatus.FORBIDDEN, "ACCOUNT_NOT_ACTIVE", "Your account cannot log in.");
        }

        Map<String, Object> userJson = new LinkedHashMap<>();
        userJson.put("userId", user.userId());
        userJson.put("name", user.name());
        userJson.put("email", user.email());
        userJson.put("role", user.role());
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Login successful");
        response.put("token", tokens.accessToken(user.userId(), user.role()));
        response.put("refreshToken", tokens.issueRefreshToken(user.userId()));
        response.put("user", userJson);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/refresh")
    public ResponseEntity<Object> refresh(@RequestBody(required = false) Map<String, Object> body) {
        Object raw = body == null ? null : body.get("refreshToken");
        if (!(raw instanceof String refreshToken)) {
            return validationError(List.of(field("refreshToken", "refreshToken must be a string")));
        }
        if (refreshToken.isEmpty()) {
            return validationError(List.of(field("refreshToken", "refreshToken is required")));
        }
        if (refreshToken.length() > 512) {
            return validationError(List.of(field("refreshToken", "refreshToken is too long")));
        }

        DemoTokens.Refreshed used = tokens.consumeRefreshToken(refreshToken);
        if (used.failure() == DemoTokens.RefreshFailure.EXPIRED) {
            return error(HttpStatus.UNAUTHORIZED, "EXPIRED_REFRESH_TOKEN", "Refresh token has expired");
        }
        if (used.failure() != null) {
            return error(HttpStatus.UNAUTHORIZED, "INVALID_REFRESH_TOKEN", "Refresh token is invalid");
        }
        Optional<Account> user = account("u.user_id = ?", used.userId());
        if (user.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "INVALID_REFRESH_TOKEN", "Refresh token is invalid");
        }
        if (!"ACTIVE".equals(user.get().status())) {
            return error(HttpStatus.FORBIDDEN, "ACCOUNT_NOT_ACTIVE", "Account is not active");
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("token", tokens.accessToken(user.get().userId(), user.get().role()));
        response.put("refreshToken", tokens.issueRefreshToken(user.get().userId()));
        return ResponseEntity.ok(response);
    }

    /** Needs a valid access token (SecurityConfig); ends every session of the user. */
    @PostMapping("/logout")
    public Map<String, String> logout(@AuthenticationPrincipal AuthUser user) {
        tokens.revokeAll(user.userId());
        return Map.of("message", "Logged out successfully");
    }

    @GetMapping("/me")
    public ResponseEntity<Object> me(@AuthenticationPrincipal AuthUser caller) {
        Optional<Account> found = account("u.user_id = ?", caller.userId());
        if (found.isEmpty()) {
            return error(HttpStatus.NOT_FOUND, "NOT_FOUND", "User not found");
        }
        Account user = found.get();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("userId", user.userId());
        response.put("name", user.name());
        response.put("email", user.email());
        response.put("phone", user.phone());
        response.put("role", user.role());
        response.put("status", user.status());
        response.put("createdAt", user.createdAt());
        response.put("lastLoginAt", user.lastLoginAt());
        return ResponseEntity.ok(response);
    }

    private Optional<Account> account(String where, Object value) {
        return jdbc.query(ACCOUNT_SQL + where, (rs, i) -> new Account(rs.getInt("user_id"), rs.getString("name"),
                rs.getString("email"), rs.getString("phone"), rs.getString("password_hash"),
                rs.getString("status"), rs.getString("role"),
                rs.getObject("created_at", LocalDateTime.class),
                rs.getObject("last_login_at", LocalDateTime.class)), value).stream().findFirst();
    }

    private static Map<String, String> field(String name, String message) {
        return Map.of("field", name, "message", message);
    }

    /** Team 1's validation error: {"error": {"code", "message", "fields": [{"field", "message"}]}}. */
    private static ResponseEntity<Object> validationError(List<Map<String, String>> fields) {
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("code", "VALIDATION_ERROR");
        error.put("message", "Request validation failed");
        error.put("fields", fields);
        return ResponseEntity.badRequest().body(Map.of("error", error));
    }

    private static ResponseEntity<Object> error(HttpStatus status, String code, String message) {
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("code", code);
        error.put("message", message);
        return ResponseEntity.status(status).body(Map.of("error", error));
    }
}
