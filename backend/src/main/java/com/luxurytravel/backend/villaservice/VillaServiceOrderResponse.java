package com.luxurytravel.backend.villaservice;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record VillaServiceOrderResponse(
        Long id,
        String orderType,
        String status,
        Long bookingId,
        String bookingRoomCode,
        String bookingGuestName,
        String customerName,
        String customerPhone,
        LocalDate serviceDate,
        String notes,
        Double serviceTotal,
        Double vendorCostTotal,
        Double depositAmount,
        Double remainingAmount,
        Double bookingBaseAmount,
        Double finalTotal,
        Instant createdAt,
        Instant updatedAt,
        List<VillaServiceOrderItemResponse> items
) {
}
