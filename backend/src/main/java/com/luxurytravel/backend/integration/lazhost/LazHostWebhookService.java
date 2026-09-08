package com.luxurytravel.backend.integration.lazhost;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

@Service
public class LazHostWebhookService {
    private final LazHostProperties properties;
    private final LazHostWebhookEventRepository webhookEventRepository;
    private final ObjectMapper objectMapper;

    public LazHostWebhookService(LazHostProperties properties, LazHostWebhookEventRepository webhookEventRepository, ObjectMapper objectMapper) {
        this.properties = properties;
        this.webhookEventRepository = webhookEventRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public LazHostWebhookAckResponse receive(String payload, String signature) {
        if (payload == null || payload.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payload is empty");
        }

        String normalizedSignature = signature == null ? "" : signature.trim();
        boolean signatureOk = verifySignature(payload, normalizedSignature);

        ExtractedWebhookFields fields = extractFields(payload);
        if (fields.eventId() != null && !fields.eventId().isBlank() && webhookEventRepository.existsByEventId(fields.eventId().trim())) {
            return new LazHostWebhookAckResponse(true, fields.eventType(), fields.eventId(), fields.externalBookingId(), "Duplicate ignored");
        }

        LazHostWebhookEvent event = new LazHostWebhookEvent();
        event.setEventType(fields.eventType());
        event.setEventId(fields.eventId());
        event.setExternalBookingId(fields.externalBookingId());
        event.setPayload(limit(payload));
        event.setReceivedSignature(normalizedSignature);
        event.setProcessed(false);
        if (!signatureOk) {
            event.setErrorMessage("Invalid signature");
            event.setProcessed(true);
            event.setProcessedAt(Instant.now());
            webhookEventRepository.save(event);
            return new LazHostWebhookAckResponse(true, fields.eventType(), fields.eventId(), fields.externalBookingId(), "Stored (invalid signature)");
        }

        webhookEventRepository.save(event);
        return new LazHostWebhookAckResponse(true, fields.eventType(), fields.eventId(), fields.externalBookingId(), "Stored");
    }

    private boolean verifySignature(String payload, String signature) {
        String secret = properties.getWebhookSigningSecret();
        if (secret == null || secret.isBlank()) {
            return true;
        }
        if (signature == null || signature.isBlank()) {
            return false;
        }
        String expected = hmacSha256Hex(payload, secret);
        return constantTimeEquals(expected, signature);
    }

    private ExtractedWebhookFields extractFields(String payload) {
        try {
            JsonNode root = objectMapper.readTree(payload);
            String eventType = firstNonBlank(
                    textAt(root, "type"),
                    textAt(root, "eventType"),
                    textAt(root, "event.type")
            );
            String eventId = firstNonBlank(
                    textAt(root, "id"),
                    textAt(root, "eventId"),
                    textAt(root, "event.id")
            );
            String externalBookingId = firstNonBlank(
                    textAt(root, "externalBookingId"),
                    textAt(root, "booking.externalBookingId"),
                    textAt(root, "data.externalBookingId"),
                    textAt(root, "data.booking.externalBookingId")
            );
            return new ExtractedWebhookFields(
                    eventType == null ? "UNKNOWN" : eventType,
                    eventId,
                    externalBookingId
            );
        } catch (Exception ex) {
            return new ExtractedWebhookFields("UNKNOWN", null, null);
        }
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

    private String firstNonBlank(String... values) {
        if (values == null) return null;
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                return v;
            }
        }
        return null;
    }

    private String hmacSha256Hex(String payload, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] raw = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return toHex(raw);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Cannot verify signature");
        }
    }

    private String toHex(byte[] raw) {
        StringBuilder sb = new StringBuilder(raw.length * 2);
        for (byte b : raw) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    private boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) return false;
        byte[] left = a.getBytes(StandardCharsets.UTF_8);
        byte[] right = b.getBytes(StandardCharsets.UTF_8);
        if (left.length != right.length) return false;
        int result = 0;
        for (int i = 0; i < left.length; i++) {
            result |= left[i] ^ right[i];
        }
        return result == 0;
    }

    private String limit(String s) {
        if (s == null) return "";
        if (s.length() <= 3900) return s;
        return s.substring(0, 3900);
    }

    private record ExtractedWebhookFields(String eventType, String eventId, String externalBookingId) {
    }
}
