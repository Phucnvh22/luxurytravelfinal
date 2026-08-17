package com.luxurytravel.backend.integration.airbnb;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/admin/integrations/airbnb-sync")
public class AirbnbSyncController {
    private final AirbnbCalendarSyncService airbnbCalendarSyncService;

    public AirbnbSyncController(AirbnbCalendarSyncService airbnbCalendarSyncService) {
        this.airbnbCalendarSyncService = airbnbCalendarSyncService;
    }

    @PostMapping("/sync-now")
    public AirbnbSyncRunResponse syncNow(
            @RequestParam(required = false) String roomCode,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return airbnbCalendarSyncService.syncNow(roomCode, from, to);
    }
}
