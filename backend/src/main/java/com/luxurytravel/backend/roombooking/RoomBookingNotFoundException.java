package com.luxurytravel.backend.roombooking;

public class RoomBookingNotFoundException extends RuntimeException {
    public RoomBookingNotFoundException(Long id) {
        super("Room booking not found: " + id);
    }
}
