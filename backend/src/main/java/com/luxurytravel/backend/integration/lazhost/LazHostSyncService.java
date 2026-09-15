package com.luxurytravel.backend.integration.lazhost;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luxurytravel.backend.roombooking.RoomBooking;
import com.luxurytravel.backend.roombooking.RoomBookingRepository;
import com.luxurytravel.backend.roombooking.RoomBookingStatus;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Service
public class LazHostSyncService {
    public static final String SYSTEM_NAME = "LAZHOST";

    private final LazHostClient lazHostClient;
    private final LazHostProperties properties;
    private final LazHostVillaMappingService mappingService;
    private final LazHostVillaMappingRepository mappingRepository;
    private final LazHostHoldRepository holdRepository;
    private final LazHostSyncLogRepository syncLogRepository;
    private final LazHostWebhookEventRepository webhookEventRepository;
    private final LazHostOperationRecorder operationRecorder;
    private final RoomBookingRepository roomBookingRepository;
    private final ObjectMapper objectMapper;

    public LazHostSyncService(
            LazHostClient lazHostClient,
            LazHostProperties properties,
            LazHostVillaMappingService mappingService,
            LazHostVillaMappingRepository mappingRepository,
            LazHostHoldRepository holdRepository,
            LazHostSyncLogRepository syncLogRepository,
            LazHostWebhookEventRepository webhookEventRepository,
            LazHostOperationRecorder operationRecorder,
            RoomBookingRepository roomBookingRepository,
            ObjectMapper objectMapper
    ) {
        this.lazHostClient = lazHostClient;
        this.properties = properties;
        this.mappingService = mappingService;
        this.mappingRepository = mappingRepository;
        this.holdRepository = holdRepository;
        this.syncLogRepository = syncLogRepository;
        this.webhookEventRepository = webhookEventRepository;
        this.operationRecorder = operationRecorder;
        this.roomBookingRepository = roomBookingRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public LazHostConnectionStatusResponse getConnectionStatus() {
        return new LazHostConnectionStatusResponse(
                properties.isEnabled(),
                properties.hasCredentials(),
                properties.getApiBaseUrl(),
                properties.getOauthTokenUrl(),
                properties.getWebhookSigningSecret() != null && !properties.getWebhookSigningSecret().isBlank(),
                mappingRepository.count(),
                syncLogRepository.count(),
                webhookEventRepository.count()
        );
    }

    @Transactional(readOnly = true)
    public List<LazHostSyncLog> listRecentSyncLogs() {
        return syncLogRepository.findTop200ByOrderByIdDesc();
    }

    @Transactional(readOnly = true)
    public List<LazHostWebhookEvent> listRecentWebhookEvents() {
        return webhookEventRepository.findTop200ByOrderByIdDesc();
    }

    @Transactional
    public LazHostSyncLog syncBooking(Long bookingId) {
        RoomBooking booking = roomBookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Khong tim thay booking phong"));
        LazHostVillaMapping mapping = mappingService.getActiveByRoomCode(booking.getRoomCode());

        String externalBookingId = resolveExternalBookingId(booking);
        LazHostSyncLog log = new LazHostSyncLog();
        log.setDirection(LazHostSyncDirection.OUTBOUND);
        log.setBookingId(booking.getId());
        log.setExternalBookingId(externalBookingId);

        if (booking.getStatus() == RoomBookingStatus.CANCELLED) {
            log.setAction("CANCEL_BOOKING");
            String idempotencyKey = buildIdempotencyKey("CANCEL", booking);
            log.setIdempotencyKey(idempotencyKey);
            log.setRequestId("cancel-" + booking.getId());
            log.setPayload("{\"externalBookingId\":\"" + externalBookingId + "\"}");
            syncLogRepository.save(log);
            return cancelBooking(booking, externalBookingId, log);
        }

        if (isNotSyncableStatus(booking.getStatus())) {
            log.setStatus(LazHostSyncStatus.FAILED);
            log.setAction("SKIP_BOOKING");
            log.setPayload("{\"status\":\"" + booking.getStatus() + "\"}");
            log.setMessage("Trang thai booking khong duoc dong bo sang LazHost");
            return syncLogRepository.save(log);
        }

        if (SYSTEM_NAME.equalsIgnoreCase(booking.getExternalSystem())
                && booking.getExternalReservationId() != null
                && !booking.getExternalReservationId().isBlank()) {
            log.setAction("PATCH_BOOKING");
            String idempotencyKey = buildIdempotencyKey("PATCH", booking);
            log.setIdempotencyKey(idempotencyKey);
            log.setRequestId("patch-" + booking.getId());
            Map<String, Object> payload = buildPatchPayload(booking);
            log.setPayload(toJson(payload));
            syncLogRepository.save(log);
            return patchBooking(externalBookingId, payload, log);
        }

        log.setAction("CREATE_BOOKING");
        LocalDate checkIn = booking.getCheckInAt().toLocalDate();
        LocalDate checkOut = booking.getCheckOutAt().toLocalDate();
        String idempotencyHoldKey = buildIdempotencyKey("HOLD", booking);
        String idempotencyBookingKey = buildIdempotencyKey("BOOK", booking);

        Map<String, Object> payload = Map.of(
                "roomCode", mapping.getLazHostRoomCode(),
                "ratePlanCode", mapping.getLazHostRatePlanCode(),
                "checkIn", checkIn,
                "checkOut", checkOut,
                "externalBookingId", externalBookingId,
                "guestName", booking.getGuestName(),
                "adults", booking.getAdults()
        );
        log.setPayload(toJson(payload));
        log.setIdempotencyKey(idempotencyBookingKey);
        log.setRequestId("book-" + booking.getId());
        syncLogRepository.save(log);

        try {
            LazHostClient.LazHostCreateHoldRequest holdRequest = new LazHostClient.LazHostCreateHoldRequest(
                    mapping.getLazHostRoomCode(),
                    mapping.getLazHostRatePlanCode(),
                    checkIn,
                    checkOut,
                    booking.getAdults()
            );
            LazHostClient.LazHostHoldResponse holdResponse = lazHostClient.createHoldResponse(
                    holdRequest,
                    idempotencyHoldKey,
                    "hold-" + booking.getId()
            );
            String holdId = holdResponse.holdId();
            log.setHoldId(holdId);
            LazHostHold hold = upsertSyncHold(holdId, externalBookingId, holdRequest, "hold-" + booking.getId(), idempotencyHoldKey);
            operationRecorder.record(
                    "CREATE_HOLD",
                    "hold-" + booking.getId(),
                    idempotencyHoldKey,
                    holdRequest.toPayload(),
                    holdResponse.body(),
                    "Created hold for room booking sync"
            );
            LazHostClient.LazHostCreateBookingRequest bookingRequest = new LazHostClient.LazHostCreateBookingRequest(
                    holdId,
                    externalBookingId,
                    booking.getGuestName(),
                    resolveGuestEmail(booking),
                    booking.getAdults(),
                    booking.getNotes()
            );
            Map<?, ?> response = lazHostClient.createBooking(bookingRequest, idempotencyBookingKey, "book-" + booking.getId());
            LazHostOperation createBookingOperation = operationRecorder.record(
                    "CREATE_BOOKING",
                    "book-" + booking.getId(),
                    idempotencyBookingKey,
                    bookingRequest.toPayload(),
                    response,
                    "Created booking from synced room booking"
            );
            log.setStatus(LazHostSyncStatus.SUCCESS);
            log.setResponseBody(limit(toJson(response)));
            log.setMessage("Dong bo booking sang LazHost thanh cong");
            if (createBookingOperation != null && createBookingOperation.getOperationId() != null) {
                log.setMessage(limit(log.getMessage() + " (operationId=" + createBookingOperation.getOperationId() + ")"));
            }
            hold.setStatus(LazHostHoldStatus.CONFIRMED);
            hold.setLastError(null);
            holdRepository.save(hold);

            booking.setExternalSystem(SYSTEM_NAME);
            booking.setExternalReservationId(externalBookingId);
            roomBookingRepository.save(booking);
            return syncLogRepository.save(log);
        } catch (Exception ex) {
            if (log.getHoldId() != null && !log.getHoldId().isBlank()) {
                releaseSyncHold(log.getHoldId(), ex.getMessage());
            }
            log.setStatus(LazHostSyncStatus.FAILED);
            log.setMessage(limit(ex.getMessage()));
            return syncLogRepository.save(log);
        }
    }

    private LazHostSyncLog cancelBooking(RoomBooking booking, String externalBookingId, LazHostSyncLog log) {
        try {
            if (!SYSTEM_NAME.equalsIgnoreCase(booking.getExternalSystem())
                    || booking.getExternalReservationId() == null
                    || booking.getExternalReservationId().isBlank()) {
                log.setStatus(LazHostSyncStatus.SUCCESS);
                log.setMessage("Booking chua duoc dong bo LazHost, bo qua cancel");
                return syncLogRepository.save(log);
            }
            log.setRequestId("cancel-" + booking.getId());
            Map<?, ?> response = lazHostClient.cancelBooking(externalBookingId, log.getIdempotencyKey(), log.getRequestId());
            LazHostOperation operation = operationRecorder.record(
                    "CANCEL_BOOKING",
                    log.getRequestId(),
                    log.getIdempotencyKey(),
                    Map.of("externalBookingId", externalBookingId, "bookingId", booking.getId()),
                    response,
                    "Cancelled LazHost booking"
            );
            log.setStatus(LazHostSyncStatus.SUCCESS);
            log.setResponseBody(limit(toJson(response)));
            log.setMessage(operation != null && operation.getOperationId() != null
                    ? "Huy booking tren LazHost thanh cong (operationId=" + operation.getOperationId() + ")"
                    : "Huy booking tren LazHost thanh cong");
            holdRepository.findTopByExternalBookingIdIgnoreCaseOrderByIdDesc(externalBookingId).ifPresent(hold -> {
                hold.setStatus(LazHostHoldStatus.CANCELLED);
                hold.setLastError(null);
                holdRepository.save(hold);
            });
            return syncLogRepository.save(log);
        } catch (Exception ex) {
            log.setStatus(LazHostSyncStatus.FAILED);
            log.setMessage(limit(ex.getMessage()));
            return syncLogRepository.save(log);
        }
    }

    private LazHostSyncLog patchBooking(String externalBookingId, Map<String, Object> payload, LazHostSyncLog log) {
        try {
            Map<?, ?> response = lazHostClient.patchBooking(externalBookingId, payload, log.getIdempotencyKey(), log.getRequestId());
            LazHostOperation operation = operationRecorder.record(
                    "PATCH_BOOKING",
                    log.getRequestId(),
                    log.getIdempotencyKey(),
                    payload,
                    response,
                    "Patched LazHost booking"
            );
            log.setStatus(LazHostSyncStatus.SUCCESS);
            log.setResponseBody(limit(toJson(response)));
            log.setMessage(operation != null && operation.getOperationId() != null
                    ? "Cap nhat booking tren LazHost thanh cong (operationId=" + operation.getOperationId() + ")"
                    : "Cap nhat booking tren LazHost thanh cong");
            return syncLogRepository.save(log);
        } catch (Exception ex) {
            log.setStatus(LazHostSyncStatus.FAILED);
            log.setMessage(limit(ex.getMessage()));
            return syncLogRepository.save(log);
        }
    }

    private boolean isNotSyncableStatus(RoomBookingStatus status) {
        return status == RoomBookingStatus.PENDING
                || status == RoomBookingStatus.TEMP_BLOCK
                || status == RoomBookingStatus.AIRBNB_BLOCK
                || status == RoomBookingStatus.KAYSTAY_BLOCK
                || status == RoomBookingStatus.SOPHIA_BLOCK;
    }

    private String resolveExternalBookingId(RoomBooking booking) {
        if (booking.getBookingCode() != null && !booking.getBookingCode().isBlank()) {
            return booking.getBookingCode().trim();
        }
        return "BK-S" + booking.getId();
    }

    private String resolveGuestEmail(RoomBooking booking) {
        if (properties.getDefaultGuestEmail() == null) {
            return "";
        }
        return properties.getDefaultGuestEmail().trim();
    }

    private String buildIdempotencyKey(String action, RoomBooking booking) {
        String updatedAt = booking.getUpdatedAt() == null ? "" : booking.getUpdatedAt().toString();
        return "LAZHOST-" + action + "-" + booking.getId() + "-" + updatedAt;
    }

    private LazHostHold upsertSyncHold(
            String holdId,
            String externalBookingId,
            LazHostClient.LazHostCreateHoldRequest request,
            String requestId,
            String idempotencyKey
    ) {
        LazHostHold hold = holdRepository.findByHoldIdIgnoreCase(holdId).orElseGet(LazHostHold::new);
        hold.setHoldId(holdId);
        hold.setExternalBookingId(externalBookingId);
        hold.setRoomCode(request.roomCode());
        hold.setRatePlanCode(request.ratePlanCode());
        hold.setCheckIn(request.checkIn());
        hold.setCheckOut(request.checkOut());
        hold.setAdults(request.adults() == null ? 1 : request.adults());
        hold.setStatus(LazHostHoldStatus.ACTIVE);
        hold.setExpiresAt(java.time.Instant.now().plusSeconds(15 * 60));
        hold.setRequestId(requestId);
        hold.setIdempotencyKey(idempotencyKey);
        hold.setLastError(null);
        return holdRepository.save(hold);
    }

    private void releaseSyncHold(String holdId, String failureMessage) {
        holdRepository.findByHoldIdIgnoreCase(holdId).ifPresent(hold -> {
            try {
                lazHostClient.deleteHold(
                        hold.getHoldId(),
                        "LAZHOST-SYNC-RELEASE-" + hold.getHoldId(),
                        "sync-release-" + hold.getHoldId()
                );
                hold.setStatus(LazHostHoldStatus.RELEASED);
                hold.setLastError(failureMessage);
            } catch (Exception releaseException) {
                hold.setStatus(LazHostHoldStatus.FAILED);
                hold.setLastError(limit((failureMessage == null ? "Create booking failed" : failureMessage)
                        + ". Release failed: "
                        + releaseException.getMessage()));
            }
            holdRepository.save(hold);
        });
    }

    private Map<String, Object> buildPatchPayload(RoomBooking booking) {
        String guestEmail = resolveGuestEmail(booking);
        Map<String, Object> guest = guestEmail.isBlank()
                ? Map.of("name", booking.getGuestName())
                : Map.of("name", booking.getGuestName(), "email", guestEmail);
        return Map.of(
                "guest", guest,
                "note", booking.getNotes() == null ? "" : booking.getNotes()
        );
    }

    private String toJson(Object value) {
        try {
            return limit(objectMapper.writeValueAsString(value));
        } catch (Exception ex) {
            return "{}";
        }
    }

    private String limit(String s) {
        if (s == null) return "";
        if (s.length() <= 3900) return s;
        return s.substring(0, 3900);
    }
}
