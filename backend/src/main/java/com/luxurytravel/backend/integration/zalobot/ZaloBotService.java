package com.luxurytravel.backend.integration.zalobot;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.luxurytravel.backend.room.Room;
import com.luxurytravel.backend.user.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

@Service
public class ZaloBotService {
    private static final Logger log = LoggerFactory.getLogger(ZaloBotService.class);
    private static final DateTimeFormatter CLEANED_AT_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")
            .withZone(ZoneId.of("Asia/Ho_Chi_Minh"));

    private final ZaloBotProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public ZaloBotService(ZaloBotProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    public void sendCleaningCompletedMessage(Room room, User cleaner) {
        if (room == null) {
            return;
        }
        if (!properties.isReadyToSend()) {
            log.warn("Skip Zalo notification because bot integration is not configured");
            return;
        }

        String chatId = room.getZaloGroupChatId() == null ? "" : room.getZaloGroupChatId().trim();
        if (chatId.isBlank()) {
            log.warn("Skip Zalo notification for villa {} because no chat_id is configured", room.getCode());
            return;
        }

        log.info("Sending Zalo cleaning notification for villa {} to chatId={}", room.getCode(), chatId);
        sendMessage(chatId, buildCleaningCompletedText(room, cleaner));
    }

    public void sendMessage(String chatId, String text) {
        if (!properties.isReadyToSend()) {
            throw new IllegalStateException("Zalo Bot integration is not configured");
        }

        String normalizedChatId = chatId == null ? "" : chatId.trim();
        if (normalizedChatId.isBlank()) {
            throw new IllegalArgumentException("chat_id is required");
        }

        String normalizedText = text == null ? "" : text.trim();
        if (normalizedText.isBlank()) {
            throw new IllegalArgumentException("text is required");
        }

        try {
            ObjectNode payload = objectMapper.createObjectNode();
            payload.put("chat_id", normalizedChatId);
            payload.put("text", normalizedText);

            String baseUrl = properties.getApiBaseUrl() == null ? "https://bot-api.zaloplatforms.com" : properties.getApiBaseUrl().trim();
            String token = properties.getToken().trim();
            URI uri = URI.create(baseUrl + "/bot" + token + "/sendMessage");

            HttpRequest request = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(15))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload), StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("Zalo sendMessage returned HTTP " + response.statusCode() + " body=" + response.body());
            }

            JsonNode root = objectMapper.readTree(response.body());
            if (!root.path("ok").asBoolean(false)) {
                throw new IllegalStateException("Zalo sendMessage returned ok=false body=" + response.body());
            }
            log.info("Zalo message sent successfully: chatId={}, messageId={}", normalizedChatId, root.path("result").path("message_id").asText(""));
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to send Zalo Bot message", ex);
        }
    }

    private String buildCleaningCompletedText(Room room, User cleaner) {
        String cleanerName = cleaner == null
                ? "Cleaner"
                : (cleaner.getFullName() == null || cleaner.getFullName().isBlank()
                ? cleaner.getUsername()
                : cleaner.getFullName());
        String cleanedAt = room.getCleanedAt() == null ? CLEANED_AT_FORMATTER.format(java.time.Instant.now()) : CLEANED_AT_FORMATTER.format(room.getCleanedAt());

        return """
                Villa %s - %s
                Cleaner: %s
                Trang thai: Da don phong xong
                Thoi gian: %s
                """.formatted(
                room.getCode(),
                room.getName(),
                cleanerName == null || cleanerName.isBlank() ? "Cleaner" : cleanerName,
                cleanedAt
        ).trim();
    }
}
