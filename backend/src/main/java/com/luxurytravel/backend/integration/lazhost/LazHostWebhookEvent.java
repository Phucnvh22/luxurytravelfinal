package com.luxurytravel.backend.integration.lazhost;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "lazhost_webhook_events")
public class LazHostWebhookEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String eventType;

    @Column(length = 100)
    private String eventId;

    @Column(length = 100)
    private String externalBookingId;

    @Column(nullable = false, length = 4000)
    private String payload;

    @Column(length = 255)
    private String receivedSignature;

    @Column(nullable = false)
    private boolean processed = false;

    @Column(length = 1000)
    private String errorMessage;

    @Column(nullable = false)
    private Instant createdAt;

    @Column
    private Instant processedAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public String getEventId() {
        return eventId;
    }

    public void setEventId(String eventId) {
        this.eventId = eventId;
    }

    public String getExternalBookingId() {
        return externalBookingId;
    }

    public void setExternalBookingId(String externalBookingId) {
        this.externalBookingId = externalBookingId;
    }

    public String getPayload() {
        return payload;
    }

    public void setPayload(String payload) {
        this.payload = payload;
    }

    public String getReceivedSignature() {
        return receivedSignature;
    }

    public void setReceivedSignature(String receivedSignature) {
        this.receivedSignature = receivedSignature;
    }

    public boolean isProcessed() {
        return processed;
    }

    public void setProcessed(boolean processed) {
        this.processed = processed;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getProcessedAt() {
        return processedAt;
    }

    public void setProcessedAt(Instant processedAt) {
        this.processedAt = processedAt;
    }
}
