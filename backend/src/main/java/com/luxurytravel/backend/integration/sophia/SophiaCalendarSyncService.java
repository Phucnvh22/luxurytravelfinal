package com.luxurytravel.backend.integration.sophia;

import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
public class SophiaCalendarSyncService {

    public void scheduledSync() {
        // Sophia crawling is temporarily disabled.
    }

    public SophiaSyncRunResponse syncNow(String roomCode, LocalDate from, LocalDate to) {
        return new SophiaSyncRunResponse(
                false,
                "Sophia sync is temporarily disabled.",
                List.of("Sophia sync is temporarily disabled.")
        );
    }
}
