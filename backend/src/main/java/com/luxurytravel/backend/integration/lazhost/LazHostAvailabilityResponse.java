package com.luxurytravel.backend.integration.lazhost;

import java.time.LocalDate;
import java.util.List;

public record LazHostAvailabilityResponse(
        LocalDate checkIn,
        LocalDate checkOut,
        List<Item> items
) {
    public record Item(
            String villaTypeCode,
            long totalUnits,
            long availableUnits,
            boolean available,
            String roomCode,
            String ratePlanCode,
            Double totalPrice,
            Double pmsPrice,
            Double otaPrice,
            String currency
    ) {
    }
}
