package com.luxurytravel.backend.room;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class RoomOOIRequest {
    @NotBlank
    @Size(max = 2000)
    private String details;

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }
}
