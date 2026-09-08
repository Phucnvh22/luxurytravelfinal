package com.luxurytravel.backend.integration.lazhost;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/integrations/lazhost/holds")
public class LazHostHoldAdminController {
    private final LazHostHoldService holdService;
    private final LazHostHoldRepository holdRepository;

    public LazHostHoldAdminController(LazHostHoldService holdService, LazHostHoldRepository holdRepository) {
        this.holdService = holdService;
        this.holdRepository = holdRepository;
    }

    @GetMapping
    public List<LazHostHold> list() {
        return holdRepository.findTop200ByOrderByIdDesc();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LazHostHold create(@Valid @RequestBody LazHostHoldCreateRequest request) {
        return holdService.createHold(request);
    }

    @PostMapping("/{holdId}/release")
    public LazHostHold release(@PathVariable String holdId) {
        return holdService.releaseHold(holdId);
    }
}
