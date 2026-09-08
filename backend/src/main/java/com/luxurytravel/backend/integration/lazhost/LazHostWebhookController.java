package com.luxurytravel.backend.integration.lazhost;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/integrations/lazhost/webhook")
public class LazHostWebhookController {
    private final LazHostWebhookService webhookService;

    public LazHostWebhookController(LazHostWebhookService webhookService) {
        this.webhookService = webhookService;
    }

    @PostMapping("/events")
    public LazHostWebhookAckResponse receive(@RequestBody String payload, @RequestHeader(name = "X-Signature", required = false) String signature) {
        return webhookService.receive(payload, signature);
    }
}
