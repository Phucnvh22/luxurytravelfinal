package com.luxurytravel.backend.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

import static org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR;

@Service
public class WhatsappCloudApiService {
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @Value("${application.whatsapp.cloud-api.token:}")
    private String token;

    @Value("${application.whatsapp.cloud-api.phone-number-id:}")
    private String phoneNumberId;

    @Value("${application.whatsapp.cloud-api.template-name:}")
    private String templateName;

    @Value("${application.whatsapp.cloud-api.template-language:en_US}")
    private String templateLanguage;

    public void sendOtp(String phoneNumber, String otp) {
        if (token == null || token.isBlank() || phoneNumberId == null || phoneNumberId.isBlank()) {
            throw new ResponseStatusException(INTERNAL_SERVER_ERROR, "WhatsApp OTP is not configured");
        }

        String to = normalizeTo(phoneNumber);
        String body = buildPayload(to, otp);
        URI uri = URI.create("https://graph.facebook.com/v20.0/" + phoneNumberId + "/messages");

        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(15))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();

        try {
            HttpResponse<String> resp = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            int status = resp.statusCode();
            if (status < 200 || status >= 300) {
                throw new ResponseStatusException(INTERNAL_SERVER_ERROR, "Failed to send WhatsApp OTP");
            }
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(INTERNAL_SERVER_ERROR, "Failed to send WhatsApp OTP");
        }
    }

    private String buildPayload(String to, String otp) {
        String escapedOtp = otp.replace("\\", "\\\\").replace("\"", "\\\"");
        if (templateName != null && !templateName.isBlank()) {
            String escapedTemplate = templateName.replace("\\", "\\\\").replace("\"", "\\\"");
            String escapedLang = templateLanguage == null ? "en_US" : templateLanguage.replace("\\", "\\\\").replace("\"", "\\\"");
            return "{"
                    + "\"messaging_product\":\"whatsapp\","
                    + "\"to\":\"" + to + "\","
                    + "\"type\":\"template\","
                    + "\"template\":{"
                    + "\"name\":\"" + escapedTemplate + "\","
                    + "\"language\":{\"code\":\"" + escapedLang + "\"},"
                    + "\"components\":[{\"type\":\"body\",\"parameters\":[{\"type\":\"text\",\"text\":\"" + escapedOtp + "\"}]}]"
                    + "}"
                    + "}";
        }

        return "{"
                + "\"messaging_product\":\"whatsapp\","
                + "\"to\":\"" + to + "\","
                + "\"type\":\"text\","
                + "\"text\":{\"preview_url\":false,\"body\":\"Your OTP is: " + escapedOtp + "\"}"
                + "}";
    }

    private String normalizeTo(String phoneNumber) {
        String digits = phoneNumber == null ? "" : phoneNumber.replaceAll("[^0-9]", "");
        if (digits.isBlank()) {
            throw new ResponseStatusException(INTERNAL_SERVER_ERROR, "Invalid phone number");
        }
        return digits;
    }
}

