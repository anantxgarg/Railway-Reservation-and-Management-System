package com.example.gateway.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class MoneyTest {

    @Test
    void testToPaiseConversion() {
        assertEquals(100L, Money.toPaise(BigDecimal.valueOf(1.00)));
        assertEquals(50000L, Money.toPaise(BigDecimal.valueOf(500.00)));
        assertEquals(123456L, Money.toPaise(BigDecimal.valueOf(1234.56)));
    }

    @Test
    void testPercentOfCalculation() {
        BigDecimal base = BigDecimal.valueOf(500.00);
        assertEquals(BigDecimal.valueOf(200.00).setScale(2), Money.percentOf(base, BigDecimal.valueOf(40)));
        assertEquals(BigDecimal.valueOf(125.00).setScale(2), Money.percentOf(base, BigDecimal.valueOf(25)));
        assertEquals(BigDecimal.valueOf(0.00).setScale(2), Money.percentOf(base, BigDecimal.ZERO));
    }
}
