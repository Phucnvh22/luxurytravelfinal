package com.luxurytravel.backend.integration.ezcloud;

public record EzCloudConnectionStatusResponse(
        boolean enabled,
        boolean configured,
        String baseUrl,
        String propertyCode,
        String authHeaderName,
        boolean webhookTokenConfigured,
        long roomMappings,
        long syncLogs,
        long webhookEvents
) {
}
