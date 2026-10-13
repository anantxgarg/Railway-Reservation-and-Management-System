package com.example.gateway.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.frameoptions.XFrameOptionsHeaderWriter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                // Allow H2 console iframes (dev only)
                .headers(headers -> headers
                        .frameOptions(frame -> frame.disable()))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Static web resources
                        .requestMatchers("/", "/index.html", "/css/**", "/js/**", "/favicon.ico", "/*.jpg").permitAll()
                        // H2 browser console (dev only)
                        .requestMatchers("/h2-console/**").permitAll()
                        // Public payment webhooks (secured via Razorpay HMAC signature)
                        .requestMatchers("/api/payments/webhook").permitAll()
                        // Public fare preview
                        .requestMatchers("/api/concessions/preview").permitAll()
                        // Public development auth/token endpoints
                        .requestMatchers("/api/auth/**").permitAll()
                        // In dev mode allow booking creation or authenticate
                        .requestMatchers("/api/bookings/**").permitAll()
                        // All other APIs require authentication
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
