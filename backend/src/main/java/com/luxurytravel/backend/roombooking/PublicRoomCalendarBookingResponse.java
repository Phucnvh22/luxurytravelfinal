package com.luxurytravel.backend.roombooking;

import java.time.LocalDateTime;

public record PublicRoomCalendarBookingResponse(
        Long id,
        String roomCode,
        LocalDateTime checkInAt,
        LocalDateTime checkOutAt,
        RoomBookingStatus status
) {
    public static PublicRoomCalendarBookingResponse from(RoomBooking entity) {
        return new PublicRoomCalendarBookingResponse(
                entity.getId(),
                entity.getRoomCode(),
                entity.getCheckInAt(),
                entity.getCheckOutAt(),
                entity.getStatus()
        );
    }
}
