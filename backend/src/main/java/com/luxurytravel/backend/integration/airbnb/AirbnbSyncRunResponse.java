package com.luxurytravel.backend.integration.airbnb;

import java.util.List;

public record AirbnbSyncRunResponse(
        boolean success,
        String message,
        List<String> logs
) {
}
