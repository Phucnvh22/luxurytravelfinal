package com.luxurytravel.backend.integration.lazhost;

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
@Table(name = "lazhost_villa_mappings")
public class LazHostVillaMapping {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String roomCode;

    @Column(nullable = false, unique = true, length = 100)
    private String lazHostRoomCode;

    @Column(length = 100)
    private String lazHostRatePlanCode;

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

    public String getLazHostRoomCode() {
        return lazHostRoomCode;
    }

    public void setLazHostRoomCode(String lazHostRoomCode) {
        this.lazHostRoomCode = lazHostRoomCode;
    }

    public String getLazHostRatePlanCode() {
        return lazHostRatePlanCode;
    }

    public void setLazHostRatePlanCode(String lazHostRatePlanCode) {
        this.lazHostRatePlanCode = lazHostRatePlanCode;
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
