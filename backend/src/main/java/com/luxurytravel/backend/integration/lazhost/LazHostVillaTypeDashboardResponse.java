package com.luxurytravel.backend.integration.lazhost;

import java.time.LocalDate;
import java.util.List;

public record LazHostVillaTypeDashboardResponse(
        LocalDate from,
        LocalDate to,
        List<LazHostVillaTypeDashboardItem> items
) {
    public record LazHostVillaTypeDashboardItem(
            String villaTypeCode,
            long totalUnits,
            long bookedUnits,
            long availableUnits,
            boolean mappingActive,
            String lazHostRoomCode,
            String lazHostRatePlanCode,
            Double pmsPrice,
            Double otaPrice,
            String currency
    ) {
    }
}
