package com.luxurytravel.backend.integration.ezcloud;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/integrations/ezcloud/webhook")
public class EzCloudWebhookController {
    private final EzCloudSyncService syncService;

    public EzCloudWebhookController(EzCloudSyncService syncService) {
        this.syncService = syncService;
    }

    @PostMapping("/reservations")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public EzCloudWebhookAckResponse reservationWebhook(
            @RequestBody JsonNode payload,
            @RequestHeader(name = "X-EzCloud-Webhook-Token", required = false) String webhookToken
    ) {
        return syncService.handleReservationWebhook(payload, webhookToken);
    }
}
