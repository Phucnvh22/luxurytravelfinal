package com.luxurytravel.backend.roombooking;

import java.time.Instant;
import java.time.LocalDateTime;

public record RoomBookingResponse(
        Long id,
        String roomCode,
        String guestName,
        String source,
        String phone,
        Integer adults,
        Integer children,
        LocalDateTime checkInAt,
        LocalDateTime checkOutAt,
        RoomBookingStatus status,
        String notes,
        Instant createdAt,
        Instant updatedAt
) {
    public static RoomBookingResponse from(RoomBooking entity) {
        return new RoomBookingResponse(
                entity.getId(),
                entity.getRoomCode(),
                entity.getGuestName(),
                entity.getSource(),
                entity.getPhone(),
                entity.getAdults(),
                entity.getChildren(),
                entity.getCheckInAt(),
                entity.getCheckOutAt(),
                entity.getStatus(),
                entity.getNotes(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
