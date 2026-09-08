package com.luxurytravel.backend.integration.lazhost;

import jakarta.validation.constraints.Size;

public class LazHostVillaMappingUpsertRequest {
    @Size(max = 50)
    private String roomCode;

    @Size(max = 100)
    private String lazHostRoomCode;

    @Size(max = 100)
    private String lazHostRatePlanCode;

    private Boolean active;

    @Size(max = 1000)
    private String notes;

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

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }
}
