package com.luxurytravel.backend.integration.lazhost;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luxurytravel.backend.roombooking.RoomBooking;
import com.luxurytravel.backend.roombooking.RoomBookingRepository;
import com.luxurytravel.backend.roombooking.RoomBookingStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
public class LazHostWebhookEventProcessor {
    private final LazHostWebhookEventRepository eventRepository;
    private final RoomBookingRepository roomBookingRepository;
    private final ObjectMapper objectMapper;

    public LazHostWebhookEventProcessor(
            LazHostWebhookEventRepository eventRepository,
            RoomBookingRepository roomBookingRepository,
            ObjectMapper objectMapper
    ) {
        this.eventRepository = eventRepository;
        this.roomBookingRepository = roomBookingRepository;
        this.objectMapper = objectMapper;
    }

    @Scheduled(fixedDelayString = "${application.integrations.lazhost.webhook-processor-fixed-delay-ms:5000}")
    @Transactional
    public void processBatch() {
        List<LazHostWebhookEvent> events = eventRepository.findTop100ByProcessedFalseOrderByIdAsc();
        for (LazHostWebhookEvent event : events) {
            processOne(event);
        }
    }

    private void processOne(LazHostWebhookEvent event) {
        try {
            ParsedWebhook payload = parse(event.getPayload());
            if (payload.externalBookingId() != null && payload.status() != null) {
                Optional<RoomBooking> maybeBooking = roomBookingRepository.findByExternalSystemIgnoreCaseAndExternalReservationId(
                        LazHostSyncService.SYSTEM_NAME,
                        payload.externalBookingId()
                );
                if (maybeBooking.isPresent()) {
                    RoomBooking booking = maybeBooking.get();
                    RoomBookingStatus next = mapStatus(payload.status());
                    if (next != null && booking.getStatus() != next) {
                        booking.setStatus(next);
                        roomBookingRepository.save(booking);
                    }
                }
            }

            event.setProcessed(true);
            event.setProcessedAt(Instant.now());
            if (event.getErrorMessage() != null && !event.getErrorMessage().isBlank()) {
                event.setErrorMessage(event.getErrorMessage());
            } else {
                event.setErrorMessage(null);
            }
            eventRepository.save(event);
        } catch (Exception ex) {
            event.setProcessed(true);
            event.setProcessedAt(Instant.now());
            event.setErrorMessage(ex.getMessage());
            eventRepository.save(event);
        }
    }

    private ParsedWebhook parse(String raw) {
        try {
            JsonNode root = objectMapper.readTree(raw);
            String externalBookingId = firstText(
                    root,
                    "externalBookingId",
                    "booking.externalBookingId",
                    "data.externalBookingId",
                    "data.booking.externalBookingId"
            );
            String status = firstText(
                    root,
                    "status",
                    "booking.status",
                    "data.status",
                    "data.booking.status"
            );
            return new ParsedWebhook(externalBookingId, status);
        } catch (Exception ex) {
            return new ParsedWebhook(null, null);
        }
    }

    private String firstText(JsonNode root, String... paths) {
        if (paths == null) return null;
        for (String path : paths) {
            String value = textAt(root, path);
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private String textAt(JsonNode root, String path) {
        if (root == null || path == null || path.isBlank()) {
            return null;
        }
        String[] parts = path.split("\\.");
        JsonNode current = root;
        for (String part : parts) {
            if (current == null) return null;
            current = current.get(part);
        }
        if (current == null || current.isNull()) {
            return null;
        }
        String value = current.asText();
        return value == null || value.isBlank() ? null : value.trim();
    }

    private RoomBookingStatus mapStatus(String lazStatus) {
        if (lazStatus == null || lazStatus.isBlank()) return null;
        String normalized = lazStatus.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "CONFIRMED" -> RoomBookingStatus.CONFIRMED;
            case "CANCELLED" -> RoomBookingStatus.CANCELLED;
            case "CHECKED_IN" -> RoomBookingStatus.CHECKED_IN;
            case "CHECKED_OUT" -> RoomBookingStatus.CHECKED_OUT;
            case "NO_SHOW" -> RoomBookingStatus.CANCELLED;
            default -> null;
        };
    }

    private record ParsedWebhook(String externalBookingId, String status) {
    }
}

