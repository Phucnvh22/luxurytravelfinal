package com.luxurytravel.backend.integration.lazhost;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

@Component
public class LazHostTokenService {
    private final LazHostProperties properties;
    private final RestClient restClient;
    private final AtomicReference<TokenState> tokenState = new AtomicReference<>();

    public LazHostTokenService(LazHostProperties properties, RestClient.Builder restClientBuilder) {
        this.properties = properties;
        this.restClient = restClientBuilder.build();
    }

    public String getAccessToken() {
        requireConfigured();
        TokenState existing = tokenState.get();
        if (existing != null && existing.isValid()) {
            return existing.accessToken();
        }
        return refreshAccessToken();
    }

    public String refreshAccessToken() {
        requireConfigured();
        TokenState next = fetchToken();
        tokenState.set(next);
        return next.accessToken();
    }

    private TokenState fetchToken() {
        String basic = Base64.getEncoder().encodeToString((properties.getClientId() + ":" + properties.getClientSecret()).getBytes(StandardCharsets.UTF_8));
        Map<?, ?> body = restClient.post()
                .uri(properties.getOauthTokenUrl())
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .accept(MediaType.APPLICATION_JSON)
                .header(HttpHeaders.AUTHORIZATION, "Basic " + basic)
                .body("grant_type=client_credentials")
                .retrieve()
                .body(Map.class);
        if (body == null) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_GATEWAY, "LazHost token response empty");
        }

        Object accessTokenValue = body.get("access_token");
        Object expiresInValue = body.get("expires_in");
        if (!(accessTokenValue instanceof String accessToken) || accessToken.isBlank()) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_GATEWAY, "LazHost token missing access_token");
        }
        long expiresInSeconds = 0L;
        if (expiresInValue instanceof Number n) {
            expiresInSeconds = n.longValue();
        } else if (expiresInValue instanceof String s && !s.isBlank()) {
            expiresInSeconds = Long.parseLong(s.trim());
        }
        long safeSeconds = Math.max(0, expiresInSeconds - 10);
        Instant expiresAt = Instant.now().plusSeconds(safeSeconds);
        return new TokenState(accessToken, expiresAt);
    }

    private void requireConfigured() {
        if (!properties.isEnabled() || !properties.hasCredentials()) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.PRECONDITION_FAILED, "LazHost chua duoc cau hinh day du");
        }
    }

    private record TokenState(String accessToken, Instant expiresAt) {
        boolean isValid() {
            return accessToken != null && !accessToken.isBlank() && expiresAt != null && Instant.now().isBefore(expiresAt);
        }
    }
}
