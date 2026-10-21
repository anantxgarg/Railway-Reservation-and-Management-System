package com.example.gateway.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

@Entity
@Table(name = "processed_webhook_events")
@Getter
@Setter
@NoArgsConstructor
public class ProcessedWebhookEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String eventId;

    private String eventType;

    @Column(columnDefinition = "TEXT")
    private String payloadSummary;

    private OffsetDateTime createdAt = OffsetDateTime.now();

    public ProcessedWebhookEvent(String eventId, String eventType, String payloadSummary) {
        this.eventId = eventId;
        this.eventType = eventType;
        this.payloadSummary = payloadSummary;
        this.createdAt = OffsetDateTime.now();
    }
}
