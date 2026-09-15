package com.luxurytravel.backend.integration.lazhost;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class LazHostClient {
    private final LazHostProperties properties;
    private final LazHostTokenService tokenService;
    private final RestClient restClient;

    public LazHostClient(LazHostProperties properties, LazHostTokenService tokenService, RestClient.Builder restClientBuilder) {
        this.properties = properties;
        this.tokenService = tokenService;
        this.restClient = restClientBuilder.build();
    }

    public String createHold(LazHostCreateHoldRequest request, String idempotencyKey, String requestId) {
        return createHoldResponse(request, idempotencyKey, requestId).holdId();
    }

    public LazHostHoldResponse createHoldResponse(LazHostCreateHoldRequest request, String idempotencyKey, String requestId) {
        Map<?, ?> body = exchange("POST", "/holds", request.toPayload(), idempotencyKey, requestId, Map.class);
        if (body == null) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_GATEWAY, "LazHost hold response empty");
        }
        Object holdId = body.get("holdId");
        if (!(holdId instanceof String s) || s.isBlank()) {
            holdId = body.get("id");
        }
        if (!(holdId instanceof String holdIdString) || holdIdString.isBlank()) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_GATEWAY, "LazHost hold response missing holdId");
        }
        return new LazHostHoldResponse(holdIdString, body);
    }

    public Map<?, ?> createBooking(LazHostCreateBookingRequest request, String idempotencyKey, String requestId) {
        return exchange("POST", "/bookings", request.toPayload(), idempotencyKey, requestId, Map.class);
    }

    public Map<?, ?> patchBooking(String externalBookingId, Map<String, Object> payload, String idempotencyKey, String requestId) {
        String path = "/bookings/" + externalBookingId;
        return exchange("PATCH", path, payload, idempotencyKey, requestId, Map.class);
    }

    public Map<?, ?> cancelBooking(String externalBookingId, String idempotencyKey, String requestId) {
        String path = "/bookings/" + externalBookingId + "/cancel";
        return exchange("POST", path, Map.of(), idempotencyKey, requestId, Map.class);
    }

    public Map<?, ?> getHold(String holdId, String requestId) {
        String path = "/holds/" + holdId;
        return exchangeNoBody("GET", path, requestId, Map.class);
    }

    public void deleteHold(String holdId, String idempotencyKey, String requestId) {
        String path = "/holds/" + holdId;
        exchangeNoBody("DELETE", path, idempotencyKey, requestId, Void.class);
    }

    public Map<?, ?> getOperation(String operationId, String requestId) {
        String path = "/operations/" + operationId;
        return exchangeNoBody("GET", path, requestId, Map.class);
    }

    public JsonNode getProperty(String requestId) {
        return exchangeNoBody("GET", "/property", requestId, JsonNode.class);
    }

    public JsonNode getRooms(String cursor, Integer limit, String requestId) {
        return exchangeNoBody("GET", buildUrl("/rooms", Map.of(
                "cursor", cursor,
                "limit", limit == null ? 100 : limit
        )), null, requestId, JsonNode.class, true);
    }

    public JsonNode getRatePlans(String cursor, Integer limit, String requestId) {
        return exchangeNoBody("GET", buildUrl("/rate-plans", Map.of(
                "cursor", cursor,
                "limit", limit == null ? 100 : limit
        )), null, requestId, JsonNode.class, true);
    }

    public JsonNode getAvailability(String roomCode, String ratePlanCode, LocalDate checkIn, LocalDate checkOut, Integer adults, String requestId) {
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("roomCode", roomCode);
        params.put("ratePlanCode", ratePlanCode);
        params.put("checkIn", checkIn);
        params.put("checkOut", checkOut);
        params.put("adults", adults == null ? 1 : adults);
        params.put("quantity", 1);
        return exchangeNoBody("GET", buildUrl("/availability", params), null, requestId, JsonNode.class, true);
    }

    public JsonNode getBooking(String externalBookingId, String requestId) {
        return exchangeNoBody("GET", "/bookings/" + externalBookingId, requestId, JsonNode.class);
    }

    private <T> T exchange(String method, String path, Object payload, String idempotencyKey, String requestId, Class<T> bodyType) {
        requireConfigured();
        String url = buildUrl(path);
        try {
            return doExchange(method, url, payload, idempotencyKey, requestId, bodyType, false);
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().value() == 401) {
                tokenService.refreshAccessToken();
                return doExchange(method, url, payload, idempotencyKey, requestId, bodyType, true);
            }
            throw new ResponseStatusException(ex.getStatusCode(), ex.getResponseBodyAsString() == null ? "LazHost request failed" : ex.getResponseBodyAsString());
        }
    }

    private <T> T exchangeNoBody(String method, String path, String requestId, Class<T> bodyType) {
        return exchangeNoBody(method, path, null, requestId, bodyType);
    }

    private <T> T exchangeNoBody(String method, String path, String idempotencyKey, String requestId, Class<T> bodyType) {
        return exchangeNoBody(method, path, idempotencyKey, requestId, bodyType, false);
    }

    private <T> T exchangeNoBody(String method, String pathOrUrl, String idempotencyKey, String requestId, Class<T> bodyType, boolean absoluteUrl) {
        requireConfigured();
        String url = absoluteUrl ? pathOrUrl : buildUrl(pathOrUrl);
        try {
            return doExchangeNoBody(method, url, idempotencyKey, requestId, bodyType, false);
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().value() == 401) {
                tokenService.refreshAccessToken();
                return doExchangeNoBody(method, url, idempotencyKey, requestId, bodyType, true);
            }
            throw new ResponseStatusException(ex.getStatusCode(), ex.getResponseBodyAsString() == null ? "LazHost request failed" : ex.getResponseBodyAsString());
        }
    }

    private <T> T doExchange(String method, String url, Object payload, String idempotencyKey, String requestId, Class<T> bodyType, boolean retrying) {
        RestClient.RequestBodySpec request = switch (method) {
            case "POST" -> restClient.post().uri(url);
            case "PATCH" -> restClient.patch().uri(url);
            default -> throw new ResponseStatusException(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR, "Unsupported method");
        };

        RestClient.RequestBodySpec headersSpec = request
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenService.getAccessToken());
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            headersSpec = headersSpec.header("Idempotency-Key", idempotencyKey);
        }
        if (requestId != null && !requestId.isBlank()) {
            headersSpec = headersSpec.header("X-Request-Id", requestId);
        }
        return headersSpec.body(payload).retrieve().body(bodyType);
    }

    private <T> T doExchangeNoBody(String method, String url, String idempotencyKey, String requestId, Class<T> bodyType, boolean retrying) {
        RestClient.RequestHeadersSpec<?> request = switch (method) {
            case "GET" -> restClient.get().uri(url);
            case "DELETE" -> restClient.delete().uri(url);
            default -> throw new ResponseStatusException(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR, "Unsupported method");
        };

        RestClient.RequestHeadersSpec<?> headersSpec = request
                .accept(MediaType.APPLICATION_JSON)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenService.getAccessToken());
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            headersSpec = headersSpec.header("Idempotency-Key", idempotencyKey);
        }
        if (requestId != null && !requestId.isBlank()) {
            headersSpec = headersSpec.header("X-Request-Id", requestId);
        }
        return headersSpec.retrieve().body(bodyType);
    }

    private void requireConfigured() {
        if (!properties.isEnabled() || !properties.hasCredentials()) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.PRECONDITION_FAILED, "LazHost chua duoc cau hinh day du");
        }
    }

    private String buildUrl(String path) {
        String baseUrl = properties.getApiBaseUrl() == null ? "" : properties.getApiBaseUrl().trim();
        String normalizedPath = path == null ? "" : path.trim();
        if (normalizedPath.startsWith("http://") || normalizedPath.startsWith("https://")) {
            return normalizedPath;
        }
        if (baseUrl.endsWith("/") && normalizedPath.startsWith("/")) {
            return baseUrl.substring(0, baseUrl.length() - 1) + normalizedPath;
        }
        if (!baseUrl.endsWith("/") && !normalizedPath.startsWith("/")) {
            return baseUrl + "/" + normalizedPath;
        }
        return baseUrl + normalizedPath;
    }

    private String buildUrl(String path, Map<String, ?> queryParams) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(buildUrl(path));
        if (queryParams != null) {
            queryParams.forEach((key, value) -> {
                if (key == null || key.isBlank() || value == null) {
                    return;
                }
                if (value instanceof String stringValue && stringValue.isBlank()) {
                    return;
                }
                builder.queryParam(key, value);
            });
        }
        return builder.build(true).toUriString();
    }

    public record LazHostCreateHoldRequest(
            String roomCode,
            String ratePlanCode,
            LocalDate checkIn,
            LocalDate checkOut,
            Integer adults
    ) {
        Map<String, Object> toPayload() {
            return Map.of(
                    "roomCode", roomCode,
                    "ratePlanCode", ratePlanCode,
                    "checkIn", checkIn,
                    "checkOut", checkOut,
                    "adults", adults == null ? 1 : adults,
                    "quantity", 1
            );
        }
    }

    public record LazHostCreateBookingRequest(
            String holdId,
            String externalBookingId,
            String guestName,
            String guestEmail,
            Integer adults,
            String note
    ) {
        Map<String, Object> toPayload() {
            Map<String, Object> guest = guestEmail == null || guestEmail.isBlank()
                    ? Map.of("name", guestName)
                    : Map.of("name", guestName, "email", guestEmail);
            return Map.of(
                    "holdId", holdId,
                    "externalBookingId", externalBookingId,
                    "guest", guest,
                    "adults", adults == null ? 1 : adults,
                    "note", note == null ? "" : note
            );
        }
    }

    public record LazHostHoldResponse(
            String holdId,
            Map<?, ?> body
    ) {
    }
}
