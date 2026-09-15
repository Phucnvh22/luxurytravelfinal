package com.luxurytravel.backend.integration.lazhost;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;

public record LazHostCatalogSnapshotResponse(
        String snapshotType,
        String source,
        Instant refreshedAt,
        JsonNode payload
) {
}
