package com.luxurytravel.backend.integration.ezcloud;

public record EzCloudApiResponse(
        int statusCode,
        String body
) {
}
