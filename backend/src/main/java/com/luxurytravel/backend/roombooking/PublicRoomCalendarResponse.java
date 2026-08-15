package com.luxurytravel.backend.roombooking;

import java.util.List;

public record PublicRoomCalendarResponse(
        List<PublicRoomCalendarRoomResponse> rooms,
        List<PublicRoomCalendarBookingResponse> bookings
) {
}
