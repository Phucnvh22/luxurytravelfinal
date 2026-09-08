package com.luxurytravel.backend.integration.lazhost;

import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/admin/integrations/lazhost/villa-type-dashboard")
public class LazHostVillaTypeDashboardController {
    private final LazHostVillaTypeDashboardService dashboardService;

    public LazHostVillaTypeDashboardController(LazHostVillaTypeDashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping
    public LazHostVillaTypeDashboardResponse load(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return dashboardService.load(from, to);
    }

    @PutMapping
    public LazHostVillaTypeDashboardResponse upsert(@Valid @RequestBody LazHostVillaTypeDashboardUpsertRequest request) {
        return dashboardService.upsert(request);
    }
}
