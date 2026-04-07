package com.luxurytravel.backend.admin;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/requests")
public class AdminRequestSummaryController {
    private final AdminRequestSummaryService adminRequestSummaryService;

    public AdminRequestSummaryController(AdminRequestSummaryService adminRequestSummaryService) {
        this.adminRequestSummaryService = adminRequestSummaryService;
    }

    @GetMapping("/summary")
    public AdminRequestSummaryResponse summary() {
        return adminRequestSummaryService.summary();
    }
}

