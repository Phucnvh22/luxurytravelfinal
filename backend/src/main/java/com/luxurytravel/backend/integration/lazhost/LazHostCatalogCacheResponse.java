package com.luxurytravel.backend.integration.lazhost;

import java.util.List;

public record LazHostCatalogCacheResponse(
        List<LazHostCatalogSnapshotResponse> snapshots
) {
}
