package com.example.gateway.web;

import com.example.gateway.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final JwtUtil jwtUtil;

    public record TokenRequest(Integer userId, String email, String role) {}

    @PostMapping("/token")
    public ResponseEntity<Map<String, Object>> generateToken(@RequestBody(required = false) TokenRequest req) {
        Integer userId = (req != null && req.userId() != null) ? req.userId() : 1;
        String email = (req != null && req.email() != null) ? req.email() : "customer@example.com";
        String role = (req != null && req.role() != null) ? req.role().toUpperCase() : "CUSTOMER";

        String token = jwtUtil.generateToken(userId, email, role);

        return ResponseEntity.ok(Map.of(
                "token", token,
                "tokenType", "Bearer",
                "userId", userId,
                "email", email,
                "role", role
        ));
    }
}
