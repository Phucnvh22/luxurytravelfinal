package com.luxurytravel.backend.roombooking;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public class RoomBookingRequest {
    @NotBlank
    @Size(max = 50)
    private String roomCode;

    @NotBlank
    @Size(max = 255)
    private String guestName;

    @Size(max = 255)
    private String source;

    @Size(max = 50)
    private String phone;

    @NotNull
    @Min(1)
    private Integer adults;

    @NotNull
    @Min(0)
    private Integer children;

    @NotNull
    private LocalDateTime checkInAt;

    @NotNull
    private LocalDateTime checkOutAt;

    @NotNull
    private RoomBookingStatus status;

    @Size(max = 2000)
    private String notes;

    public String getRoomCode() {
        return roomCode;
    }

    public void setRoomCode(String roomCode) {
        this.roomCode = roomCode;
    }

    public String getGuestName() {
        return guestName;
    }

    public void setGuestName(String guestName) {
        this.guestName = guestName;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public Integer getAdults() {
        return adults;
    }

    public void setAdults(Integer adults) {
        this.adults = adults;
    }

    public Integer getChildren() {
        return children;
    }

    public void setChildren(Integer children) {
        this.children = children;
    }

    public LocalDateTime getCheckInAt() {
        return checkInAt;
    }

    public void setCheckInAt(LocalDateTime checkInAt) {
        this.checkInAt = checkInAt;
    }

    public LocalDateTime getCheckOutAt() {
        return checkOutAt;
    }

    public void setCheckOutAt(LocalDateTime checkOutAt) {
        this.checkOutAt = checkOutAt;
    }

    public RoomBookingStatus getStatus() {
        return status;
    }

    public void setStatus(RoomBookingStatus status) {
        this.status = status;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }
}
