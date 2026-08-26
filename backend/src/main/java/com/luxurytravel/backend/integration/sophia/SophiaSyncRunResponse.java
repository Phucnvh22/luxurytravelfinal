package com.luxurytravel.backend.integration.sophia;

import java.util.List;

public record SophiaSyncRunResponse(
        boolean success,
        String message,
        List<String> logs
) {
}
