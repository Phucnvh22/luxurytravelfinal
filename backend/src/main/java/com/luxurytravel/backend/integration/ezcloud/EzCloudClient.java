package com.luxurytravel.backend.integration.ezcloud;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDate;
import java.util.Map;

@Component
public class EzCloudClient {
    private final EzCloudProperties properties;
    private final RestClient restClient;

    public EzCloudClient(EzCloudProperties properties, RestClient.Builder restClientBuilder) {
        this.properties = properties;
        this.restClient = restClientBuilder.build();
    }

    public EzCloudApiResponse createReservation(Map<String, Object> payload) {
        return exchange(properties.getCreateReservationPath(), payload);
    }

    public EzCloudApiResponse updateReservation(String externalReservationId, Map<String, Object> payload) {
        return exchange(properties.getUpdateReservationPath().replace("{reservationId}", externalReservationId), payload);
    }

    public EzCloudApiResponse cancelReservation(String externalReservationId, Map<String, Object> payload) {
        return exchange(properties.getCancelReservationPath().replace("{reservationId}", externalReservationId), payload);
    }

    public EzCloudApiResponse pullReservations(LocalDate from, LocalDate to) {
        requireConfigured();
        String url = UriComponentsBuilder.fromUriString(buildUrl(properties.getPullReservationsPath()))
                .queryParam("propertyCode", properties.getPropertyCode())
                .queryParam("from", from)
                .queryParam("to", to)
                .toUriString();
        String body = restClient.get()
                .uri(url)
                .accept(MediaType.APPLICATION_JSON)
                .header(properties.getAuthHeaderName(), properties.getApiToken())
                .retrieve()
                .body(String.class);
        return new EzCloudApiResponse(200, body == null ? "" : body);
    }

    private EzCloudApiResponse exchange(String path, Map<String, Object> payload) {
        requireConfigured();
        String body = restClient.post()
                .uri(buildUrl(path))
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .header(properties.getAuthHeaderName(), properties.getApiToken())
                .body(payload)
                .retrieve()
                .body(String.class);
        return new EzCloudApiResponse(200, body == null ? "" : body);
    }

    private void requireConfigured() {
        if (!properties.isEnabled() || !properties.hasCredentials()) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.PRECONDITION_FAILED, "EzCloud chua duoc cau hinh day du");
        }
    }

    private String buildUrl(String path) {
        String baseUrl = properties.getBaseUrl() == null ? "" : properties.getBaseUrl().trim();
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
}
