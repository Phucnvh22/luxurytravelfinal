package com.luxurytravel.backend.integration.lazhost;

import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

public record LazHostVillaTypeDashboardUpsertRequest(
        LocalDate from,
        LocalDate to,
        List<Item> items
) {
    public record Item(
            @Size(max = 255) String villaTypeCode,
            Boolean mappingActive,
            @Size(max = 100) String lazHostRoomCode,
            @Size(max = 100) String lazHostRatePlanCode,
            Double pmsPrice,
            Double otaPrice,
            @Size(max = 10) String currency
    ) {
    }
}
