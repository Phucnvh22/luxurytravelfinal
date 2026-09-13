package com.luxurytravel.backend.integration.zalobot;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/integrations/zalo-bot/webhook")
public class ZaloBotWebhookController {
    private final ZaloBotWebhookService webhookService;

    public ZaloBotWebhookController(ZaloBotWebhookService webhookService) {
        this.webhookService = webhookService;
    }

    @PostMapping
    public ZaloBotWebhookAckResponse receive(
            @RequestBody(required = false) String payload,
            @RequestHeader(name = "X-Bot-Api-Secret-Token", required = false) String secretToken
    ) {
        return webhookService.receive(payload, secretToken);
    }
}
