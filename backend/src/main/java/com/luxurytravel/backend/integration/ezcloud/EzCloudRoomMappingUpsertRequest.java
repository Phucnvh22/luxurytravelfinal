package com.luxurytravel.backend.integration.ezcloud;

import jakarta.validation.constraints.Size;

public class EzCloudRoomMappingUpsertRequest {
    @Size(max = 50)
    private String roomCode;

    @Size(max = 100)
    private String ezCloudRoomCode;

    @Size(max = 100)
    private String ezCloudRatePlanCode;

    private Boolean active;

    @Size(max = 1000)
    private String notes;

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
