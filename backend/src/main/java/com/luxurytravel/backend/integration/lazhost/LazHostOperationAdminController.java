package com.luxurytravel.backend.integration.lazhost;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/integrations/lazhost/operations")
public class LazHostOperationAdminController {
    private final LazHostOperationService operationService;

    public LazHostOperationAdminController(LazHostOperationService operationService) {
        this.operationService = operationService;
    }

    @GetMapping
    public List<LazHostOperation> list() {
        return operationService.listRecent();
    }

    @PostMapping("/{operationId}/refresh")
    public LazHostOperation refresh(@PathVariable String operationId) {
        return operationService.refresh(operationId);
    }
}
