package com.luxurytravel.backend.room;

public class RoomNotFoundException extends RuntimeException {
    public RoomNotFoundException(Long id) {
        super("Room not found: " + id);
    }
}
