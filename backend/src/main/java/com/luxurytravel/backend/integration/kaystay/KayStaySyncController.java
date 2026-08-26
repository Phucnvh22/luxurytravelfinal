package com.luxurytravel.backend.integration.kaystay;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/admin/integrations/kaystay-sync")
public class KayStaySyncController {
    private final KayStayCalendarSyncService kayStayCalendarSyncService;

    public KayStaySyncController(KayStayCalendarSyncService kayStayCalendarSyncService) {
        this.kayStayCalendarSyncService = kayStayCalendarSyncService;
    }

    @PostMapping("/sync-now")
    public KayStaySyncRunResponse syncNow(
            @RequestParam(required = false) String roomCode,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return kayStayCalendarSyncService.syncNow(roomCode, from, to);
    }
}
