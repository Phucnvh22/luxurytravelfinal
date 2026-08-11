package com.luxurytravel.backend.integration.ezcloud;

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
@Table(name = "ezcloud_sync_logs")
public class EzCloudSyncLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EzCloudSyncDirection direction;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EzCloudSyncStatus status = EzCloudSyncStatus.PENDING;

    @Column(nullable = false, length = 100)
    private String action;

    @Column(name = "booking_id")
    private Long bookingId;

    @Column(length = 100)
    private String externalReservationId;

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

    public EzCloudSyncDirection getDirection() {
        return direction;
    }

    public void setDirection(EzCloudSyncDirection direction) {
        this.direction = direction;
    }

    public EzCloudSyncStatus getStatus() {
        return status;
    }

    public void setStatus(EzCloudSyncStatus status) {
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

    public String getExternalReservationId() {
        return externalReservationId;
    }

    public void setExternalReservationId(String externalReservationId) {
        this.externalReservationId = externalReservationId;
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
