package com.example.gateway.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "payments")
@Getter
@Setter
@NoArgsConstructor
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The C3 booking this pays for. */
    private String pnr;
    private Integer userId;

    @Column(unique = true)
    private String razorpayOrderId;

    private String razorpayPaymentId;

    /** In rupees. Converted to paise only when talking to Razorpay. */
    @Column(precision = 12, scale = 2)
    private BigDecimal amount;

    private String currency = "INR";

    @Enumerated(EnumType.STRING)
    private PaymentStatus status;

    @Version
    private Long version = 0L;

    private OffsetDateTime createdAt = OffsetDateTime.now();
    private OffsetDateTime updatedAt = OffsetDateTime.now();
}
