package com.example.gateway.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class JwtUtilTest {

    private JwtUtil jwtUtil;

    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil("SecretKeyForRailwayUnitTestingMustBeAtLeast32BytesLong!", 3600000L);
    }

    @Test
    void testGenerateAndValidateToken() {
        String token = jwtUtil.generateToken(42, "user@railway.test", "CUSTOMER");
        assertNotNull(token);

        assertEquals(42, jwtUtil.getUserId(token));
        assertEquals("user@railway.test", jwtUtil.getEmail(token));
        assertEquals("CUSTOMER", jwtUtil.getRole(token));
    }
}
