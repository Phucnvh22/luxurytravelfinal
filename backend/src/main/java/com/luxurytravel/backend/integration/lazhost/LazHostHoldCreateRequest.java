package com.luxurytravel.backend.integration.lazhost;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public class LazHostHoldCreateRequest {
    @Size(max = 255)
    private String villaTypeCode;

    @NotNull
    private LocalDate checkIn;

    @NotNull
    private LocalDate checkOut;

    private Integer adults;

    @Size(max = 100)
    private String externalBookingId;

    public String getVillaTypeCode() {
        return villaTypeCode;
    }

    public void setVillaTypeCode(String villaTypeCode) {
        this.villaTypeCode = villaTypeCode;
    }

    public LocalDate getCheckIn() {
        return checkIn;
    }

    public void setCheckIn(LocalDate checkIn) {
        this.checkIn = checkIn;
    }

    public LocalDate getCheckOut() {
        return checkOut;
    }

    public void setCheckOut(LocalDate checkOut) {
        this.checkOut = checkOut;
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
}
