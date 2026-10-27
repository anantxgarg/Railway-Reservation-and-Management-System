package com.railway.train.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.railway.train.error.ErrorResponse;
import com.railway.train.security.JwtAuthFilter;
import com.railway.train.security.TokenVerifier;
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
 * Who may call what. Logins are Team 1's (the same checks as booking-service):
 *   - reading the network (trains, stations, classes, coaches, routes,
 *     schedules, runs) and a run's live status is public;
 *   - live status by PNR needs a login (the owner, or staff);
 *   - staff and admins set a run's status and delay;
 *   - everything else that changes the network is for admins.
 */
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http, TokenVerifier verifier, JdbcTemplate jdbc,
                                    ObjectMapper json) throws Exception {
        var jwtFilter = new JwtAuthFilter(verifier, jdbc, json);

        http.csrf(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
                .authorizeHttpRequests(a -> a
                        .requestMatchers("/error").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/live-status/pnr/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/trains/**", "/api/trains", "/api/stations/**",
                                "/api/stations", "/api/travel-classes/**", "/api/travel-classes",
                                "/api/coaches/**", "/api/coaches", "/api/routes/**", "/api/routes",
                                "/api/route-stations/**", "/api/route-stations", "/api/schedules/**",
                                "/api/schedules", "/api/live-status/run/**").permitAll()
                        .requestMatchers(HttpMethod.PATCH, "/api/schedules/runs/*/status").hasAnyRole("STAFF", "ADMIN")
                        .anyRequest().hasRole("ADMIN"))
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
