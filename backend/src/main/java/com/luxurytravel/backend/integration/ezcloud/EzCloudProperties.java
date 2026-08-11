package com.luxurytravel.backend.integration.ezcloud;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.integrations.ezcloud")
public class EzCloudProperties {
    private boolean enabled = false;
    private String baseUrl;
    private String propertyCode;
    private String apiToken;
    private String authHeaderName = "X-API-Key";
    private String webhookToken;
    private String createReservationPath = "/api/v1/reservations";
    private String updateReservationPath = "/api/v1/reservations/{reservationId}";
    private String cancelReservationPath = "/api/v1/reservations/{reservationId}/cancel";
    private String pullReservationsPath = "/api/v1/reservations";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getPropertyCode() {
        return propertyCode;
    }

    public void setPropertyCode(String propertyCode) {
        this.propertyCode = propertyCode;
    }

    public String getApiToken() {
        return apiToken;
    }

    public void setApiToken(String apiToken) {
        this.apiToken = apiToken;
    }

    public String getAuthHeaderName() {
        return authHeaderName;
    }

    public void setAuthHeaderName(String authHeaderName) {
        this.authHeaderName = authHeaderName;
    }

    public String getWebhookToken() {
        return webhookToken;
    }

    public void setWebhookToken(String webhookToken) {
        this.webhookToken = webhookToken;
    }

    public String getCreateReservationPath() {
        return createReservationPath;
    }

    public void setCreateReservationPath(String createReservationPath) {
        this.createReservationPath = createReservationPath;
    }

    public String getUpdateReservationPath() {
        return updateReservationPath;
    }

    public void setUpdateReservationPath(String updateReservationPath) {
        this.updateReservationPath = updateReservationPath;
    }

    public String getCancelReservationPath() {
        return cancelReservationPath;
    }

    public void setCancelReservationPath(String cancelReservationPath) {
        this.cancelReservationPath = cancelReservationPath;
    }

    public String getPullReservationsPath() {
        return pullReservationsPath;
    }

    public void setPullReservationsPath(String pullReservationsPath) {
        this.pullReservationsPath = pullReservationsPath;
    }

    public boolean hasCredentials() {
        return baseUrl != null && !baseUrl.isBlank() && apiToken != null && !apiToken.isBlank();
    }
}
