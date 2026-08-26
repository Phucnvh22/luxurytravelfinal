package com.luxurytravel.backend.integration.kaystay;

import java.util.List;

public record KayStaySyncRunResponse(
        boolean success,
        String message,
        List<String> logs
) {
}
