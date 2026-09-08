package com.luxurytravel.backend.integration.lazhost;

import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

@Service
public class LazHostHoldService {
    private final LazHostClient client;
    private final LazHostHoldRepository holdRepository;
    private final LazHostVillaTypeMappingRepository villaTypeMappingRepository;

    public LazHostHoldService(
            LazHostClient client,
            LazHostHoldRepository holdRepository,
            LazHostVillaTypeMappingRepository villaTypeMappingRepository
    ) {
        this.client = client;
        this.holdRepository = holdRepository;
        this.villaTypeMappingRepository = villaTypeMappingRepository;
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
            String holdId = client.createHold(
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
            hold.setHoldId(holdId);
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
            return holdRepository.save(hold);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, ex.getMessage() == null ? "Cannot create hold" : ex.getMessage());
        }
    }

    @Transactional
    public LazHostHold releaseHold(String holdId) {
        LazHostHold hold = holdRepository.findByHoldIdIgnoreCase(holdId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Hold not found"));
        if (hold.getStatus() == LazHostHoldStatus.RELEASED || hold.getStatus() == LazHostHoldStatus.EXPIRED) {
            return hold;
        }

        try {
            client.deleteHold(hold.getHoldId(), "LAZHOST-RELEASE-" + hold.getHoldId(), "release-" + hold.getHoldId());
            hold.setStatus(LazHostHoldStatus.RELEASED);
            hold.setLastError(null);
            return holdRepository.save(hold);
        } catch (Exception ex) {
            hold.setStatus(LazHostHoldStatus.FAILED);
            hold.setLastError(ex.getMessage());
            return holdRepository.save(hold);
        }
    }

    @Scheduled(fixedDelayString = "${application.integrations.lazhost.hold-reaper-fixed-delay-ms:10000}")
    @Transactional
    public void releaseExpiredHolds() {
        Instant now = Instant.now();
        List<LazHostHold> expired = holdRepository.findTop100ByStatusAndExpiresAtBeforeOrderByExpiresAtAsc(LazHostHoldStatus.ACTIVE, now);
        for (LazHostHold hold : expired) {
            try {
                client.deleteHold(hold.getHoldId(), "LAZHOST-EXPIRE-" + hold.getHoldId(), "expire-" + hold.getHoldId());
                hold.setStatus(LazHostHoldStatus.EXPIRED);
                hold.setLastError(null);
            } catch (Exception ex) {
                hold.setStatus(LazHostHoldStatus.FAILED);
                hold.setLastError(ex.getMessage());
            }
            holdRepository.save(hold);
        }
    }

    private String normalizeKey(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }
}
