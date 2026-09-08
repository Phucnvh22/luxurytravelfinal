package com.luxurytravel.backend.integration.lazhost;

public record LazHostWebhookAckResponse(
        boolean accepted,
        String eventType,
        String eventId,
        String externalBookingId,
        String message
) {
}
