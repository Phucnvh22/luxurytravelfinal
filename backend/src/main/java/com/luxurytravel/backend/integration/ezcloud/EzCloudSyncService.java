package com.luxurytravel.backend.integration.ezcloud;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luxurytravel.backend.room.Room;
import com.luxurytravel.backend.room.RoomRepository;
import com.luxurytravel.backend.roombooking.RoomBooking;
import com.luxurytravel.backend.roombooking.RoomBookingRepository;
import com.luxurytravel.backend.roombooking.RoomBookingStatus;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class EzCloudSyncService {
    private static final String SYSTEM_NAME = "EZCLOUD";

    private final EzCloudClient ezCloudClient;
    private final EzCloudProperties properties;
    private final EzCloudRoomMappingService mappingService;
    private final EzCloudRoomMappingRepository mappingRepository;
    private final EzCloudSyncLogRepository syncLogRepository;
    private final EzCloudWebhookEventRepository webhookEventRepository;
    private final RoomBookingRepository roomBookingRepository;
    private final RoomRepository roomRepository;
    private final ObjectMapper objectMapper;

    public EzCloudSyncService(
            EzCloudClient ezCloudClient,
            EzCloudProperties properties,
            EzCloudRoomMappingService mappingService,
            EzCloudRoomMappingRepository mappingRepository,
            EzCloudSyncLogRepository syncLogRepository,
            EzCloudWebhookEventRepository webhookEventRepository,
            RoomBookingRepository roomBookingRepository,
            RoomRepository roomRepository,
            ObjectMapper objectMapper
    ) {
        this.ezCloudClient = ezCloudClient;
        this.properties = properties;
        this.mappingService = mappingService;
        this.mappingRepository = mappingRepository;
        this.syncLogRepository = syncLogRepository;
        this.webhookEventRepository = webhookEventRepository;
        this.roomBookingRepository = roomBookingRepository;
        this.roomRepository = roomRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public EzCloudConnectionStatusResponse getConnectionStatus() {
        return new EzCloudConnectionStatusResponse(
                properties.isEnabled(),
                properties.hasCredentials(),
                properties.getBaseUrl(),
                properties.getPropertyCode(),
                properties.getAuthHeaderName(),
                properties.getWebhookToken() != null && !properties.getWebhookToken().isBlank(),
                mappingRepository.count(),
                syncLogRepository.count(),
                webhookEventRepository.count()
        );
    }

    @Transactional(readOnly = true)
    public List<EzCloudSyncLog> listRecentSyncLogs() {
        return syncLogRepository.findTop50ByOrderByCreatedAtDesc();
    }

    @Transactional(readOnly = true)
    public List<EzCloudWebhookEvent> listRecentWebhookEvents() {
        return webhookEventRepository.findTop50ByOrderByCreatedAtDesc();
    }

    @Transactional
    public EzCloudSyncLog syncBooking(Long bookingId) {
        RoomBooking booking = roomBookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Khong tim thay booking phong"));
        EzCloudRoomMapping mapping = mappingService.getActiveByRoomCode(booking.getRoomCode());
        Map<String, Object> payload = buildOutboundPayload(booking, mapping);

        EzCloudSyncLog log = new EzCloudSyncLog();
        log.setDirection(EzCloudSyncDirection.OUTBOUND);
        log.setAction("UPSERT_RESERVATION");
        log.setBookingId(booking.getId());
        log.setExternalReservationId(booking.getExternalReservationId());
        log.setPayload(toJson(payload));
        syncLogRepository.save(log);

        try {
            EzCloudApiResponse response;
            if (booking.getExternalReservationId() != null && !booking.getExternalReservationId().isBlank()) {
                response = ezCloudClient.updateReservation(booking.getExternalReservationId(), payload);
            } else {
                response = ezCloudClient.createReservation(payload);
            }

            String responseBody = response.body();
            String externalReservationId = extractString(objectMapper.readTree(defaultJson(responseBody)),
                    "reservationId", "reservationCode", "id", "data.reservationId", "data.id");
            if (externalReservationId != null && !externalReservationId.isBlank()) {
                booking.setExternalSystem(SYSTEM_NAME);
                booking.setExternalReservationId(externalReservationId);
                roomBookingRepository.save(booking);
                log.setExternalReservationId(externalReservationId);
            }
            log.setStatus(EzCloudSyncStatus.SUCCESS);
            log.setResponseBody(limit(responseBody));
            log.setMessage("Dong bo booking len ezCloud thanh cong");
            return syncLogRepository.save(log);
        } catch (Exception ex) {
            log.setStatus(EzCloudSyncStatus.FAILED);
            log.setMessage(limit(ex.getMessage()));
            return syncLogRepository.save(log);
        }
    }

    @Transactional
    public EzCloudSyncLog pullReservations(LocalDate from, LocalDate to) {
        EzCloudSyncLog log = new EzCloudSyncLog();
        log.setDirection(EzCloudSyncDirection.OUTBOUND);
        log.setAction("PULL_RESERVATIONS");
        log.setPayload("{\"from\":\"" + from + "\",\"to\":\"" + to + "\"}");
        syncLogRepository.save(log);

        try {
            EzCloudApiResponse response = ezCloudClient.pullReservations(from, to);
            log.setStatus(EzCloudSyncStatus.SUCCESS);
            log.setResponseBody(limit(response.body()));
            log.setMessage("Da goi pull reservations tu ezCloud");
            return syncLogRepository.save(log);
        } catch (Exception ex) {
            log.setStatus(EzCloudSyncStatus.FAILED);
            log.setMessage(limit(ex.getMessage()));
            return syncLogRepository.save(log);
        }
    }

    @Transactional
    public EzCloudWebhookAckResponse handleReservationWebhook(JsonNode payload, String receivedToken) {
        validateWebhookToken(receivedToken);

        EzCloudWebhookEvent event = new EzCloudWebhookEvent();
        event.setEventType(firstNonBlank(
                extractString(payload, "eventType", "event", "type", "action"),
                "unknown"
        ));
        event.setExternalReservationId(extractString(payload, "reservationId", "reservationCode", "id", "reservation.id"));
        event.setChannel(extractString(payload, "channel", "source", "reservation.channel"));
        event.setReceivedToken(receivedToken);
        event.setPayload(toJson(payload));
        webhookEventRepository.save(event);

        try {
            RoomBooking booking = upsertBookingFromWebhook(payload, event.getEventType());
            event.setProcessed(true);
            event.setProcessedAt(Instant.now());
            webhookEventRepository.save(event);

            return new EzCloudWebhookAckResponse(
                    true,
                    event.getEventType(),
                    event.getExternalReservationId(),
                    booking.getId(),
                    "Da tiep nhan va cap nhat booking noi bo"
            );
        } catch (Exception ex) {
            event.setErrorMessage(limit(ex.getMessage()));
            event.setProcessedAt(Instant.now());
            webhookEventRepository.save(event);
            throw ex;
        }
    }

    private RoomBooking upsertBookingFromWebhook(JsonNode payload, String eventType) {
        String externalReservationId = extractString(payload, "reservationId", "reservationCode", "id", "reservation.id");
        if (externalReservationId == null || externalReservationId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Webhook khong co reservationId");
        }

        String externalRoomCode = extractString(payload, "ezCloudRoomCode", "roomCode", "room.code", "reservation.roomCode");
        String localRoomCode = resolveLocalRoomCode(externalRoomCode);

        Room room = roomRepository.findByCodeIgnoreCase(localRoomCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Khong map duoc phong noi bo tu webhook"));

        RoomBooking booking = roomBookingRepository
                .findByExternalSystemIgnoreCaseAndExternalReservationId(SYSTEM_NAME, externalReservationId)
                .orElseGet(RoomBooking::new);

        String statusText = extractString(payload, "status", "reservation.status");
        boolean cancelled = isCancellationEvent(eventType, statusText);
        LocalDateTime checkInAt = parseDateTime(payload, "checkInAt", "checkIn", "checkInDate", "reservation.checkInAt");
        LocalDateTime checkOutAt = parseDateTime(payload, "checkOutAt", "checkOut", "checkOutDate", "reservation.checkOutAt");
        if (!cancelled && (checkInAt == null || checkOutAt == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Webhook thieu thong tin check-in/check-out");
        }

        if (!cancelled) {
            if (roomBookingRepository.existsOverlap(localRoomCode, checkInAt, checkOutAt, booking.getId())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Lich tu ezCloud bi trung voi booking hien co");
            }
            booking.setCheckInAt(checkInAt);
            booking.setCheckOutAt(checkOutAt);
        } else if (booking.getId() == null) {
            booking.setCheckInAt(checkInAt == null ? LocalDateTime.now() : checkInAt);
            booking.setCheckOutAt(checkOutAt == null ? LocalDateTime.now().plusDays(1) : checkOutAt);
        }

        booking.setRoomCode(room.getCode());
        booking.setGuestName(firstNonBlank(extractString(payload, "guestName", "guest.name", "customerName"), "OTA Guest"));
        booking.setSource(firstNonBlank(extractString(payload, "channel", "source", "reservation.channel"), "ezCloud"));
        booking.setPhone(firstNonBlank(extractString(payload, "phone", "guest.phone", "customerPhone"), ""));
        booking.setAdults(parseInteger(payload, new String[]{"adults", "guest.adults", "occupancy.adults", "guests.adults", "paxAdults", "numberOfAdults"}, room.getMaxAdults()));
        booking.setChildren(parseInteger(payload, new String[]{"children", "guest.children", "occupancy.children", "guests.children", "paxChildren", "numberOfChildren"}, 0));
        booking.setNotes(firstNonBlank(extractString(payload, "notes", "remark", "remarks", "specialRequest"), ""));
        booking.setStatus(cancelled ? RoomBookingStatus.CANCELLED : mapStatus(statusText, eventType));
        booking.setExternalSystem(SYSTEM_NAME);
        booking.setExternalReservationId(externalReservationId);
        RoomBooking saved = roomBookingRepository.save(booking);

        EzCloudSyncLog log = new EzCloudSyncLog();
        log.setDirection(EzCloudSyncDirection.INBOUND);
        log.setAction("WEBHOOK_" + eventType.toUpperCase());
        log.setBookingId(saved.getId());
        log.setExternalReservationId(externalReservationId);
        log.setStatus(EzCloudSyncStatus.SUCCESS);
        log.setPayload(toJson(payload));
        log.setMessage("Da dong bo booking tu ezCloud vao he thong");
        syncLogRepository.save(log);

        return saved;
    }

    private Map<String, Object> buildOutboundPayload(RoomBooking booking, EzCloudRoomMapping mapping) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("propertyCode", properties.getPropertyCode());
        payload.put("reservationId", booking.getExternalReservationId());
        payload.put("roomCode", mapping.getEzCloudRoomCode());
        payload.put("ratePlanCode", mapping.getEzCloudRatePlanCode());
        payload.put("guestName", booking.getGuestName());
        payload.put("phone", booking.getPhone());
        payload.put("source", booking.getSource());
        payload.put("adults", booking.getAdults());
        payload.put("children", booking.getChildren());
        payload.put("checkInAt", booking.getCheckInAt());
        payload.put("checkOutAt", booking.getCheckOutAt());
        payload.put("status", booking.getStatus().name());
        payload.put("notes", booking.getNotes());
        payload.put("localBookingId", booking.getId());
        payload.put("localRoomCode", booking.getRoomCode());
        return payload;
    }

    private void validateWebhookToken(String receivedToken) {
        if (properties.getWebhookToken() == null || properties.getWebhookToken().isBlank()) {
            throw new ResponseStatusException(HttpStatus.PRECONDITION_FAILED, "Webhook token ezCloud chua duoc cau hinh");
        }
        if (!properties.getWebhookToken().equals(receivedToken)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Webhook token khong hop le");
        }
    }

    private String resolveLocalRoomCode(String externalRoomCode) {
        if (externalRoomCode == null || externalRoomCode.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Webhook khong co thong tin phong");
        }

        Optional<EzCloudRoomMapping> mapping = mappingRepository.findByEzCloudRoomCodeIgnoreCase(externalRoomCode);
        if (mapping.isPresent()) {
            return mapping.get().getRoomCode();
        }
        return externalRoomCode.trim().toUpperCase();
    }

    private RoomBookingStatus mapStatus(String statusText, String eventType) {
        String normalized = firstNonBlank(statusText, eventType).toLowerCase();
        if (normalized.contains("cancel")) return RoomBookingStatus.CANCELLED;
        if (normalized.contains("check_out") || normalized.contains("checkout")) return RoomBookingStatus.CHECKED_OUT;
        if (normalized.contains("check_in") || normalized.contains("checked_in") || normalized.contains("in_house")) return RoomBookingStatus.CHECKED_IN;
        if (normalized.contains("confirm") || normalized.contains("booked") || normalized.contains("reserved")) return RoomBookingStatus.CONFIRMED;
        return RoomBookingStatus.PENDING;
    }

    private boolean isCancellationEvent(String eventType, String statusText) {
        String normalized = (firstNonBlank(eventType, "") + " " + firstNonBlank(statusText, "")).toLowerCase();
        return normalized.contains("cancel");
    }

    private String extractString(JsonNode node, String... paths) {
        for (String path : paths) {
            JsonNode current = node;
            for (String part : path.split("\\.")) {
                if (current == null) break;
                current = current.get(part);
            }
            if (current != null && !current.isNull()) {
                String value = current.asText();
                if (value != null && !value.isBlank()) return value.trim();
            }
        }
        return null;
    }

    private LocalDateTime parseDateTime(JsonNode node, String... paths) {
        String raw = extractString(node, paths);
        if (raw == null || raw.isBlank()) return null;
        try {
            return LocalDateTime.parse(raw);
        } catch (DateTimeParseException ignored) {
        }
        try {
            return OffsetDateTime.parse(raw).toLocalDateTime();
        } catch (DateTimeParseException ignored) {
        }
        try {
            return LocalDate.parse(raw).atTime(14, 0);
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    private int parseInteger(JsonNode node, String[] paths, int fallback) {
        String raw = extractString(node, paths);
        if (raw == null || raw.isBlank()) return fallback;
        try {
            return Integer.parseInt(raw);
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private String toJson(Object value) {
        try {
            return limit(objectMapper.writeValueAsString(value));
        } catch (JsonProcessingException ex) {
            return "{\"error\":\"json_serialize_failed\"}";
        }
    }

    private String defaultJson(String value) {
        return value == null || value.isBlank() ? "{}" : value;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private String limit(String value) {
        if (value == null) return null;
        return value.length() <= 3900 ? value : value.substring(0, 3900);
    }
}
