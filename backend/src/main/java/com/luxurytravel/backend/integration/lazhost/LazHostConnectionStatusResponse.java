package com.luxurytravel.backend.integration.lazhost;

public record LazHostConnectionStatusResponse(
        boolean enabled,
        boolean configured,
        String apiBaseUrl,
        String oauthTokenUrl,
        boolean webhookSigningSecretConfigured,
        long villaMappings,
        long syncLogs,
        long webhookEvents
) {
}
