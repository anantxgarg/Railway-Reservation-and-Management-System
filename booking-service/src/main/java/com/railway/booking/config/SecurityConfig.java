package com.railway.booking.config;

import com.railway.booking.error.ErrorResponse;
import com.railway.booking.security.JwtAuthFilter;
import com.railway.booking.security.TokenVerifier;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Who may call what. Ownership (a customer seeing only their own PNRs) is
 * checked in BookingService, because it depends on the booking.
 */
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http, TokenVerifier verifier, JdbcTemplate jdbc,
                                    ObjectMapper json) throws Exception {
        // created here rather than as a @Component, so it runs only inside the security chain
        var jwtFilter = new JwtAuthFilter(verifier, jdbc, json);

        http.csrf(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
                .authorizeHttpRequests(a -> a
                        .requestMatchers("/error").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/search", "/api/runs/*/availability").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/bookings").hasRole("CUSTOMER")
                        .requestMatchers("/api/bookings", "/api/bookings/**").authenticated()
                        .anyRequest().authenticated())
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) ->
                                write(res, json, HttpServletResponse.SC_UNAUTHORIZED,
                                        ErrorResponse.of("MISSING_TOKEN", "Authentication required")))
                        .accessDeniedHandler((req, res, ex) ->
                                write(res, json, HttpServletResponse.SC_FORBIDDEN,
                                        ErrorResponse.of("FORBIDDEN", "Your role cannot do this"))));
        return http.build();
    }

    private static void write(HttpServletResponse res, ObjectMapper json, int status, ErrorResponse body)
            throws java.io.IOException {
        res.setStatus(status);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        json.writeValue(res.getOutputStream(), body);
    }
}
