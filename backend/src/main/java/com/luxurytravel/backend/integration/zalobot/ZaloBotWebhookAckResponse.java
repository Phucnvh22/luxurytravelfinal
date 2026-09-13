package com.luxurytravel.backend.integration.zalobot;

public record ZaloBotWebhookAckResponse(
        boolean ok,
        String chatId,
        String chatType,
        String message
) {
}
