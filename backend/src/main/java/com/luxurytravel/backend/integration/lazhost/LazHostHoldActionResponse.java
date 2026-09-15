package com.luxurytravel.backend.integration.lazhost;

import java.time.Instant;
import java.time.LocalDate;

public record LazHostHoldActionResponse(
        boolean success,
        String holdId,
        String externalBookingId,
        String roomCode,
        String ratePlanCode,
        LocalDate checkIn,
        LocalDate checkOut,
        Integer adults,
        LazHostHoldStatus status,
        Instant expiresAt,
        String requestId,
        String operationId,
        String message,
        String lastError
) {
    public static LazHostHoldActionResponse from(LazHostHold hold, String operationId, String message) {
        return new LazHostHoldActionResponse(
                hold != null && hold.getLastError() == null,
                hold == null ? "" : hold.getHoldId(),
                hold == null ? "" : hold.getExternalBookingId(),
                hold == null ? "" : hold.getRoomCode(),
                hold == null ? "" : hold.getRatePlanCode(),
                hold == null ? null : hold.getCheckIn(),
                hold == null ? null : hold.getCheckOut(),
                hold == null ? null : hold.getAdults(),
                hold == null ? null : hold.getStatus(),
                hold == null ? null : hold.getExpiresAt(),
                hold == null ? "" : hold.getRequestId(),
                operationId == null ? "" : operationId,
                message == null ? "" : message,
                hold == null ? "" : hold.getLastError()
        );
    }
}
