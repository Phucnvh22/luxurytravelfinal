package com.luxurytravel.backend.integration.zalobot;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.FORBIDDEN;

@Service
public class ZaloBotWebhookService {
    private static final Logger log = LoggerFactory.getLogger(ZaloBotWebhookService.class);

    private final ZaloBotProperties properties;
    private final ObjectMapper objectMapper;

    public ZaloBotWebhookService(ZaloBotProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    public ZaloBotWebhookAckResponse receive(String payload, String secretToken) {
        validateSecretToken(secretToken);

        try {
            JsonNode root = objectMapper.readTree(payload == null ? "{}" : payload);
            JsonNode chat = root.path("message").path("chat");
            if (chat.isMissingNode() || chat.isNull() || chat.isEmpty()) {
                chat = root.path("chat");
            }

            String chatId = text(chat, "id");
            String chatType = text(chat, "type");
            String chatTitle = text(chat, "title");
            String senderName = firstNonBlank(
                    text(root.path("message").path("from"), "name"),
                    text(root.path("from"), "name")
            );
            String text = firstNonBlank(
                    text(root.path("message"), "text"),
                    text(root, "text")
            );

            if (!chatId.isBlank()) {
                log.info(
                        "Received Zalo webhook: chatId={}, chatType={}, chatTitle={}, sender={}, text={}",
                        chatId,
                        chatType,
                        chatTitle,
                        senderName,
                        text
                );
            } else {
                log.info("Received Zalo webhook without chat.id");
            }

            String message = chatId.isBlank()
                    ? "Webhook received"
                    : "Webhook received. Use chat_id '" + chatId + "' for the villa group mapping.";
            return new ZaloBotWebhookAckResponse(true, chatId, chatType, message);
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            log.warn("Could not parse Zalo webhook payload: {}", ex.getMessage());
            return new ZaloBotWebhookAckResponse(true, "", "", "Webhook received");
        }
    }

    private void validateSecretToken(String secretToken) {
        String configuredSecret = properties.getWebhookSecretToken() == null ? "" : properties.getWebhookSecretToken().trim();
        if (configuredSecret.isBlank()) {
            return;
        }
        String incomingSecret = secretToken == null ? "" : secretToken.trim();
        if (!configuredSecret.equals(incomingSecret)) {
            throw new ResponseStatusException(FORBIDDEN, "Invalid Zalo webhook secret token");
        }
    }

    private String text(JsonNode node, String field) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return "";
        }
        JsonNode child = node.path(field);
        return child.isMissingNode() || child.isNull() ? "" : child.asText("");
    }

    private String firstNonBlank(String... candidates) {
        for (String candidate : candidates) {
            if (candidate != null && !candidate.isBlank()) {
                return candidate;
            }
        }
        return "";
    }
}
