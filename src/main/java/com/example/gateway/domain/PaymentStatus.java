package com.example.gateway.domain;

public enum PaymentStatus {
    CREATED,
    PAID,
    /** Some passengers cancelled and refunded; the rest still travel. */
    PARTIALLY_REFUNDED,
    REFUNDED
}
