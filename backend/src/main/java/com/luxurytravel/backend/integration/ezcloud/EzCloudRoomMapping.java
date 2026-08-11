package com.luxurytravel.backend.integration.ezcloud;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "ezcloud_room_mappings")
public class EzCloudRoomMapping {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String roomCode;

    @Column(nullable = false, unique = true, length = 100)
    private String ezCloudRoomCode;

    @Column(length = 100)
    private String ezCloudRatePlanCode;

    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false, length = 1000)
    private String notes = "";

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getRoomCode() {
        return roomCode;
    }

    public void setRoomCode(String roomCode) {
        this.roomCode = roomCode;
    }

    public String getEzCloudRoomCode() {
        return ezCloudRoomCode;
    }

    public void setEzCloudRoomCode(String ezCloudRoomCode) {
        this.ezCloudRoomCode = ezCloudRoomCode;
    }

    public String getEzCloudRatePlanCode() {
        return ezCloudRatePlanCode;
    }

    public void setEzCloudRatePlanCode(String ezCloudRatePlanCode) {
        this.ezCloudRatePlanCode = ezCloudRatePlanCode;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
