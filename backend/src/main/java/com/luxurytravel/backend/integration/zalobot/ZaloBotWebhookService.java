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
            JsonNode result = root.path("result");
            JsonNode messageNode = result.path("message");
            if (messageNode.isMissingNode() || messageNode.isNull() || messageNode.isEmpty()) {
                messageNode = root.path("message");
            }

            JsonNode chat = messageNode.path("chat");
            if (chat.isMissingNode() || chat.isNull() || chat.isEmpty()) {
                chat = root.path("chat");
            }

            String chatId = text(chat, "id");
            String chatType = firstNonBlank(text(chat, "chat_type"), text(chat, "type"));
            String chatTitle = text(chat, "title");
            String eventName = firstNonBlank(text(result, "event_name"), text(root, "event_name"));
            String senderName = firstNonBlank(
                    text(messageNode.path("from"), "display_name"),
                    text(messageNode.path("from"), "name"),
                    text(root.path("from"), "display_name"),
                    text(root.path("from"), "name")
            );
            String messageText = firstNonBlank(
                    text(messageNode, "text"),
                    text(messageNode, "caption"),
                    text(root, "text")
            );

            if (!chatId.isBlank()) {
                log.info(
                        "Received Zalo webhook: eventName={}, chatId={}, chatType={}, chatTitle={}, sender={}, text={}",
                        eventName,
                        chatId,
                        chatType,
                        chatTitle,
                        senderName,
                        messageText
                );
            } else {
                log.info("Received Zalo webhook without chat.id: eventName={}, payload={}", eventName, root.toString());
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
