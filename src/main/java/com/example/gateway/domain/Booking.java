package com.example.gateway.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Minimal stand-in for the ticket booking. Once the group finalises the real
 * booking module, replace this with a bookingId reference.
 */
@Entity
@Table(name = "bookings")
@Getter
@Setter
@NoArgsConstructor
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String passengerName;
    private String email;
    private String phone;
    private String origin;
    private String destination;
    private LocalDateTime departureTime;

    @Enumerated(EnumType.STRING)
    private PassengerCategory category;

    @Column(precision = 12, scale = 2)
    private BigDecimal baseFare;

    @Column(precision = 5, scale = 2)
    private BigDecimal concessionPercent;

    @Column(precision = 12, scale = 2)
    private BigDecimal concessionAmount;

    /** Amount the passenger actually pays (baseFare - concessionAmount). */
    @Column(precision = 12, scale = 2)
    private BigDecimal finalAmount;

    @Enumerated(EnumType.STRING)
    private BookingStatus status;

    private LocalDateTime createdAt = LocalDateTime.now();
}
