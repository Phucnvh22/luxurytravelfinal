package com.luxurytravel.backend.integration.ezcloud;

public record EzCloudWebhookAckResponse(
        boolean accepted,
        String eventType,
        String externalReservationId,
        Long bookingId,
        String message
) {
}
