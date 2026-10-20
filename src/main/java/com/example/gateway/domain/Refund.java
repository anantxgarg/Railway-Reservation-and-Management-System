package com.example.gateway.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "refunds")
@Getter
@Setter
@NoArgsConstructor
public class Refund {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long bookingId;
    private Long paymentId;
    private Integer userId;

    @Column(unique = true)
    private String razorpayRefundId;

    @Column(precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(precision = 5, scale = 2)
    private BigDecimal refundPercent;

    private String reason;

    @Enumerated(EnumType.STRING)
    private RefundStatus status;

    private Integer processedByStaffId;

    private LocalDateTime createdAt = LocalDateTime.now();
}
