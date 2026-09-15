package com.luxurytravel.backend.integration.lazhost;

import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class LazHostHoldService {
    private final LazHostClient client;
    private final LazHostHoldRepository holdRepository;
    private final LazHostVillaTypeMappingRepository villaTypeMappingRepository;
    private final LazHostOperationRecorder operationRecorder;

    public LazHostHoldService(
            LazHostClient client,
            LazHostHoldRepository holdRepository,
            LazHostVillaTypeMappingRepository villaTypeMappingRepository,
            LazHostOperationRecorder operationRecorder
    ) {
        this.client = client;
        this.holdRepository = holdRepository;
        this.villaTypeMappingRepository = villaTypeMappingRepository;
        this.operationRecorder = operationRecorder;
    }

    @Transactional(readOnly = true)
    public LazHostHold getHold(String holdId) {
        return holdRepository.findByHoldIdIgnoreCase(holdId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Hold not found"));
    }

    @Transactional
    public LazHostHold createHold(LazHostHoldCreateRequest request) {
        if (request.getVillaTypeCode() == null || request.getVillaTypeCode().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Villa type code is required");
        }
        if (!request.getCheckOut().isAfter(request.getCheckIn())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Check-out must be after check-in");
        }

        LazHostVillaTypeMapping mapping = villaTypeMappingRepository.findByVillaTypeCodeIgnoreCase(request.getVillaTypeCode().trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.PRECONDITION_FAILED, "Chua co mapping LazHost cho villa type"));
        if (!mapping.isActive()) {
            throw new ResponseStatusException(HttpStatus.PRECONDITION_FAILED, "Mapping LazHost dang tam tat");
        }

        String idempotencyKey = "LAZHOST-HOLD-" + normalizeKey(request.getVillaTypeCode()) + "-" + request.getCheckIn() + "-" + request.getCheckOut();
        String requestId = "hold-" + Instant.now().toEpochMilli();

        try {
            LazHostClient.LazHostHoldResponse response = client.createHoldResponse(
                    new LazHostClient.LazHostCreateHoldRequest(
                            mapping.getLazHostRoomCode(),
                            mapping.getLazHostRatePlanCode(),
                            request.getCheckIn(),
                            request.getCheckOut(),
                            request.getAdults()
                    ),
                    idempotencyKey,
                    requestId
            );

            LazHostHold hold = new LazHostHold();
            hold.setHoldId(response.holdId());
            hold.setExternalBookingId(request.getExternalBookingId());
            hold.setRoomCode(mapping.getLazHostRoomCode());
            hold.setRatePlanCode(mapping.getLazHostRatePlanCode());
            hold.setCheckIn(request.getCheckIn());
            hold.setCheckOut(request.getCheckOut());
            hold.setAdults(request.getAdults() == null ? 1 : request.getAdults());
            hold.setStatus(LazHostHoldStatus.ACTIVE);
            hold.setExpiresAt(Instant.now().plusSeconds(15 * 60));
            hold.setRequestId(requestId);
            hold.setIdempotencyKey(idempotencyKey);
            LazHostHold saved = holdRepository.save(hold);
            operationRecorder.record(
                    "CREATE_HOLD",
                    requestId,
                    idempotencyKey,
                    new LazHostClient.LazHostCreateHoldRequest(
                            mapping.getLazHostRoomCode(),
                            mapping.getLazHostRatePlanCode(),
                            request.getCheckIn(),
                            request.getCheckOut(),
                            request.getAdults()
                    ).toPayload(),
                    response.body(),
                    "Created hold"
            );
            return saved;
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, ex.getMessage() == null ? "Cannot create hold" : ex.getMessage());
        }
    }

    @Transactional
    public LazHostHold releaseHold(String holdId) {
        LazHostHold hold = getHold(holdId);
        if (hold.getStatus() == LazHostHoldStatus.RELEASED
                || hold.getStatus() == LazHostHoldStatus.EXPIRED
                || hold.getStatus() == LazHostHoldStatus.CANCELLED) {
            return hold;
        }
        if (hold.getStatus() == LazHostHoldStatus.CONFIRMED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Confirmed hold must be cancelled as a booking");
        }

        return releaseExistingHold(hold, "LAZHOST-RELEASE-" + hold.getHoldId(), "release-" + hold.getHoldId(), LazHostHoldStatus.RELEASED);
    }

    @Transactional
    public LazHostHoldActionResponse confirmHold(String holdId, LazHostHoldConfirmRequest request) {
        LazHostHold hold = getHold(holdId);
        if (hold.getStatus() == LazHostHoldStatus.CONFIRMED) {
            return LazHostHoldActionResponse.from(hold, "", "Hold already confirmed");
        }
        if (hold.getStatus() != LazHostHoldStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only active holds can be confirmed");
        }

        String guestName = request.getGuestName() == null ? "" : request.getGuestName().trim();
        if (guestName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Guest name is required");
        }

        String externalBookingId = normalizeExternalBookingId(request.getExternalBookingId(), hold);
        Integer adults = request.getAdults() == null ? hold.getAdults() : request.getAdults();
        String guestEmail = normalizeOptional(request.getGuestEmail());
        String note = normalizeOptional(request.getNote());
        String requestId = "confirm-" + hold.getHoldId();
        String idempotencyKey = "LAZHOST-CONFIRM-" + hold.getHoldId();

        try {
            Map<?, ?> response = client.createBooking(
                    new LazHostClient.LazHostCreateBookingRequest(
                            hold.getHoldId(),
                            externalBookingId,
                            guestName,
                            guestEmail,
                            adults,
                            note
                    ),
                    idempotencyKey,
                    requestId
            );
            LazHostOperation operation = operationRecorder.record(
                    "CONFIRM_BOOKING",
                    requestId,
                    idempotencyKey,
                    Map.of(
                            "holdId", hold.getHoldId(),
                            "externalBookingId", externalBookingId,
                            "guestName", guestName,
                            "guestEmail", guestEmail == null ? "" : guestEmail,
                            "adults", adults == null ? 1 : adults,
                            "note", note == null ? "" : note
                    ),
                    response,
                    "Confirmed booking from hold"
            );
            hold.setExternalBookingId(externalBookingId);
            hold.setAdults(adults == null ? 1 : adults);
            hold.setStatus(LazHostHoldStatus.CONFIRMED);
            hold.setLastError(null);
            LazHostHold saved = holdRepository.save(hold);
            return LazHostHoldActionResponse.from(saved, operation == null ? "" : operation.getOperationId(), "Booking confirmed");
        } catch (Exception ex) {
            String failureMessage = ex.getMessage() == null ? "Cannot confirm booking" : ex.getMessage();
            LazHostHold saved = releaseFailedConfirmationHold(hold, failureMessage);
            return LazHostHoldActionResponse.from(saved, "", failureMessage);
        }
    }

    @Transactional
    public LazHostHoldActionResponse cancelConfirmedBooking(String holdId) {
        LazHostHold hold = getHold(holdId);
        if (hold.getStatus() == LazHostHoldStatus.CANCELLED) {
            return LazHostHoldActionResponse.from(hold, "", "Booking already cancelled");
        }
        if (hold.getStatus() != LazHostHoldStatus.CONFIRMED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only confirmed holds can be cancelled");
        }
        String externalBookingId = normalizeOptional(hold.getExternalBookingId());
        if (externalBookingId == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Confirmed hold is missing externalBookingId");
        }

        String requestId = "cancel-public-" + hold.getHoldId();
        String idempotencyKey = "LAZHOST-CANCEL-" + hold.getHoldId();
        try {
            Map<?, ?> response = client.cancelBooking(externalBookingId, idempotencyKey, requestId);
            LazHostOperation operation = operationRecorder.record(
                    "CANCEL_BOOKING",
                    requestId,
                    idempotencyKey,
                    Map.of("holdId", hold.getHoldId(), "externalBookingId", externalBookingId),
                    response,
                    "Cancelled confirmed booking"
            );
            hold.setStatus(LazHostHoldStatus.CANCELLED);
            hold.setLastError(null);
            LazHostHold saved = holdRepository.save(hold);
            return LazHostHoldActionResponse.from(saved, operation == null ? "" : operation.getOperationId(), "Booking cancelled");
        } catch (Exception ex) {
            hold.setLastError(ex.getMessage());
            LazHostHold saved = holdRepository.save(hold);
            return LazHostHoldActionResponse.from(saved, "", ex.getMessage());
        }
    }

    @Scheduled(fixedDelayString = "${application.integrations.lazhost.hold-reaper-fixed-delay-ms:10000}")
    @Transactional
    public void releaseExpiredHolds() {
        Instant now = Instant.now();
        List<LazHostHold> expired = holdRepository.findTop100ByStatusAndExpiresAtBeforeOrderByExpiresAtAsc(LazHostHoldStatus.ACTIVE, now);
        for (LazHostHold hold : expired) {
            releaseExistingHold(hold, "LAZHOST-EXPIRE-" + hold.getHoldId(), "expire-" + hold.getHoldId(), LazHostHoldStatus.EXPIRED);
        }
    }

    private LazHostHold releaseExistingHold(LazHostHold hold, String idempotencyKey, String requestId, LazHostHoldStatus terminalStatus) {
        try {
            client.deleteHold(hold.getHoldId(), idempotencyKey, requestId);
            hold.setStatus(terminalStatus);
            hold.setLastError(null);
        } catch (Exception ex) {
            hold.setStatus(LazHostHoldStatus.FAILED);
            hold.setLastError(ex.getMessage());
        }
        return holdRepository.save(hold);
    }

    private LazHostHold releaseFailedConfirmationHold(LazHostHold hold, String failureMessage) {
        hold.setLastError(failureMessage);
        holdRepository.save(hold);
        LazHostHold released = releaseExistingHold(
                hold,
                "LAZHOST-CONFIRM-FAIL-" + hold.getHoldId(),
                "confirm-fail-" + hold.getHoldId(),
                LazHostHoldStatus.RELEASED
        );
        if (released.getStatus() == LazHostHoldStatus.FAILED && released.getLastError() != null && !released.getLastError().isBlank()) {
            released.setLastError(failureMessage + ". Release failed: " + released.getLastError());
            return holdRepository.save(released);
        }
        released.setLastError(failureMessage);
        return holdRepository.save(released);
    }

    private String normalizeKey(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeExternalBookingId(String requestedExternalBookingId, LazHostHold hold) {
        String normalized = normalizeOptional(requestedExternalBookingId);
        if (normalized != null) {
            return normalized;
        }
        String existing = normalizeOptional(hold.getExternalBookingId());
        if (existing != null) {
            return existing;
        }
        return "LH-HOLD-" + hold.getId();
    }

    private String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }
}
