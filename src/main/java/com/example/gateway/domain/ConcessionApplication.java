package com.example.gateway.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "concession_applications")
@Getter
@Setter
@NoArgsConstructor
public class ConcessionApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String pnr;
    /** The passenger of the booking the concession is for (C3 passenger). */
    private Integer passengerId;
    private Integer userId;
    private String passengerName;

    @Enumerated(EnumType.STRING)
    private PassengerCategory category;

    private String idCardType;
    private String idCardNumber;
    private String documentReferenceUrl;

    @Column(precision = 5, scale = 2)
    private BigDecimal discountPercent;

    @Column(precision = 12, scale = 2)
    private BigDecimal discountAmount;

    @Enumerated(EnumType.STRING)
    private ConcessionStatus status = ConcessionStatus.PENDING;

    private Integer verifiedByStaffId;
    private String remarks;

    private OffsetDateTime createdAt = OffsetDateTime.now();
    private OffsetDateTime updatedAt = OffsetDateTime.now();
}
