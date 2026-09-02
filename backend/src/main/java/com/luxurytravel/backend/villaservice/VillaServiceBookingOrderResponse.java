package com.luxurytravel.backend.villaservice;

import com.luxurytravel.backend.roombooking.RoomBookingResponse;

public record VillaServiceBookingOrderResponse(
        RoomBookingResponse booking,
        VillaServiceOrderResponse order
) {
}
