package com.luxurytravel.backend.integration.lazhost;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "lazhost_sync_logs")
public class LazHostSyncLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LazHostSyncDirection direction;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LazHostSyncStatus status = LazHostSyncStatus.PENDING;

    @Column(nullable = false, length = 100)
    private String action;

    @Column(name = "booking_id")
    private Long bookingId;

    @Column(length = 100)
    private String externalBookingId;

    @Column(length = 100)
    private String holdId;

    @Column(length = 100)
    private String idempotencyKey;

    @Column(length = 100)
    private String requestId;

    @Column(nullable = false, length = 4000)
    private String payload = "";

    @Column(length = 4000)
    private String responseBody;

    @Column(length = 1000)
    private String message;

    @Column(nullable = false)
    private Instant createdAt;

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

    public LazHostSyncDirection getDirection() {
        return direction;
    }

    public void setDirection(LazHostSyncDirection direction) {
        this.direction = direction;
    }

    public LazHostSyncStatus getStatus() {
        return status;
    }

    public void setStatus(LazHostSyncStatus status) {
        this.status = status;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public Long getBookingId() {
        return bookingId;
    }

    public void setBookingId(Long bookingId) {
        this.bookingId = bookingId;
    }

    public String getExternalBookingId() {
        return externalBookingId;
    }

    public void setExternalBookingId(String externalBookingId) {
        this.externalBookingId = externalBookingId;
    }

    public String getHoldId() {
        return holdId;
    }

    public void setHoldId(String holdId) {
        this.holdId = holdId;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public void setIdempotencyKey(String idempotencyKey) {
        this.idempotencyKey = idempotencyKey;
    }

    public String getRequestId() {
        return requestId;
    }

    public void setRequestId(String requestId) {
        this.requestId = requestId;
    }

    public String getPayload() {
        return payload;
    }

    public void setPayload(String payload) {
        this.payload = payload;
    }

    public String getResponseBody() {
        return responseBody;
    }

    public void setResponseBody(String responseBody) {
        this.responseBody = responseBody;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
