package com.luxurytravel.backend.villaservice;

import java.time.Instant;

public record VillaServiceCatalogResponse(
        Long id,
        String name,
        Double unitPrice,
        boolean active,
        long usageCount,
        java.util.List<VillaServiceVendorResponse> vendors,
        Instant createdAt,
        Instant updatedAt
) {
}
