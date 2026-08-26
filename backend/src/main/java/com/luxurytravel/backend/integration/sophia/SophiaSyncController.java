package com.luxurytravel.backend.integration.sophia;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/admin/integrations/sophia-sync")
public class SophiaSyncController {
    private final SophiaCalendarSyncService sophiaCalendarSyncService;

    public SophiaSyncController(SophiaCalendarSyncService sophiaCalendarSyncService) {
        this.sophiaCalendarSyncService = sophiaCalendarSyncService;
    }

    @PostMapping("/sync-now")
    public SophiaSyncRunResponse syncNow(
            @RequestParam(required = false) String roomCode,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return sophiaCalendarSyncService.syncNow(roomCode, from, to);
    }
}
