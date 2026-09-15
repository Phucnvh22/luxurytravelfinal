package com.luxurytravel.backend.integration.lazhost;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class LazHostHoldConfirmRequest {
    @NotBlank
    @Size(max = 255)
    private String guestName;

    @Size(max = 255)
    private String guestEmail;

    private Integer adults;

    @Size(max = 100)
    private String externalBookingId;

    @Size(max = 1000)
    private String note;

    public String getGuestName() {
        return guestName;
    }

    public void setGuestName(String guestName) {
        this.guestName = guestName;
    }

    public String getGuestEmail() {
        return guestEmail;
    }

    public void setGuestEmail(String guestEmail) {
        this.guestEmail = guestEmail;
    }

    public Integer getAdults() {
        return adults;
    }

    public void setAdults(Integer adults) {
        this.adults = adults;
    }

    public String getExternalBookingId() {
        return externalBookingId;
    }

    public void setExternalBookingId(String externalBookingId) {
        this.externalBookingId = externalBookingId;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }
}
