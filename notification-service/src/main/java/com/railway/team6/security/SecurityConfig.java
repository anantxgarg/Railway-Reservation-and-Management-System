package com.railway.team6.security;

import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/*
 * Who may call which URL.
 *
 *   POST /api/notifications          other teams' backends (X-Internal-Key), or an admin.
 *                                    With no key configured (development), anyone.
 *   GET  /api/notifications/types    anyone (it's documentation)
 *   GET  /api/notifications/log      staff and admins
 *   GET  /api/feedback, /summary     staff and admins
 *   everything else                  any logged-in user; the controllers check that a user only
 *                                    touches their own notifications and feedback (Caller).
 */
@Configuration
public class SecurityConfig {

    private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http, TokenVerifier verifier, ObjectMapper json,
                                    @Value("${team6.internal-key}") String internalKey) throws Exception {
        boolean keyRequired = !internalKey.isBlank();
        if (!keyRequired) {
            log.warn("NOTIFICATIONS_API_KEY is not set: anyone can send notifications. Set it outside development.");
        }

        http.csrf(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(new JwtAuthFilter(verifier, internalKey.trim(), json),
                        UsernamePasswordAuthenticationFilter.class)
                .authorizeHttpRequests(a -> {
                    a.requestMatchers("/error").permitAll();
                    if (keyRequired) {
                        a.requestMatchers(HttpMethod.POST, "/api/notifications").hasAnyRole("SERVICE", "ADMIN");
                    } else {
                        a.requestMatchers(HttpMethod.POST, "/api/notifications").permitAll();
                    }
                    a.requestMatchers(HttpMethod.GET, "/api/notifications/types").permitAll()
                            .requestMatchers(HttpMethod.GET, "/api/notifications/log").hasAnyRole("STAFF", "ADMIN")
                            .requestMatchers(HttpMethod.GET, "/api/feedback", "/api/feedback/summary").hasAnyRole("STAFF", "ADMIN")
                            .requestMatchers("/api/demo/reset").hasRole("ADMIN")
                            .anyRequest().hasAnyRole("CUSTOMER", "STAFF", "ADMIN");
                })
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) -> write(res, json,
                                HttpServletResponse.SC_UNAUTHORIZED, "MISSING_TOKEN", "Authentication required"))
                        .accessDeniedHandler((req, res, ex) -> write(res, json,
                                HttpServletResponse.SC_FORBIDDEN, "FORBIDDEN", "Your role cannot do this")));
        return http.build();
    }

    private static void write(HttpServletResponse res, ObjectMapper json, int status, String code, String message)
            throws java.io.IOException {
        res.setStatus(status);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        json.writeValue(res.getOutputStream(), Map.of("error", Map.of("code", code, "message", message)));
    }
}
