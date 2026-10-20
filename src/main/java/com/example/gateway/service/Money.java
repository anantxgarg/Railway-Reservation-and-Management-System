package com.example.gateway.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

final class Money {

    private Money() {
    }

    /** Razorpay works in the smallest currency unit (paise for INR). */
    static long toPaise(BigDecimal rupees) {
        return rupees.setScale(2, RoundingMode.HALF_UP).movePointRight(2).longValueExact();
    }

    static BigDecimal percentOf(BigDecimal amount, BigDecimal percent) {
        return amount.multiply(percent).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
    }
}
