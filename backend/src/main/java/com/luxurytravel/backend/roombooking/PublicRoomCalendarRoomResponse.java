package com.luxurytravel.backend.roombooking;

import com.luxurytravel.backend.room.Room;

public record PublicRoomCalendarRoomResponse(
        String code,
        String name,
        String type,
        String location,
        String airbnbUrl
) {
    public static PublicRoomCalendarRoomResponse from(Room room) {
        return new PublicRoomCalendarRoomResponse(
                room.getCode(),
                room.getName(),
                room.getType(),
                room.getLocation(),
                room.getAirbnbUrl()
        );
    }
}
