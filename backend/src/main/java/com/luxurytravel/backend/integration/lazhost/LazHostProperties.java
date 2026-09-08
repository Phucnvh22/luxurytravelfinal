package com.luxurytravel.backend.integration.lazhost;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.integrations.lazhost")
public class LazHostProperties {
    private boolean enabled = false;
    private String apiBaseUrl = "https://b2b.lazhost.io.vn/api/v1";
    private String oauthTokenUrl = "https://b2b.lazhost.io.vn/api/oauth/token";
    private String clientId;
    private String clientSecret;
    private String defaultGuestEmail = "";
    private String webhookSigningSecret;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getApiBaseUrl() {
        return apiBaseUrl;
    }

    public void setApiBaseUrl(String apiBaseUrl) {
        this.apiBaseUrl = apiBaseUrl;
    }

    public String getOauthTokenUrl() {
        return oauthTokenUrl;
    }

    public void setOauthTokenUrl(String oauthTokenUrl) {
        this.oauthTokenUrl = oauthTokenUrl;
    }

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

    public String getClientSecret() {
        return clientSecret;
    }

    public void setClientSecret(String clientSecret) {
        this.clientSecret = clientSecret;
    }

    public String getDefaultGuestEmail() {
        return defaultGuestEmail;
    }

    public void setDefaultGuestEmail(String defaultGuestEmail) {
        this.defaultGuestEmail = defaultGuestEmail;
    }

    public String getWebhookSigningSecret() {
        return webhookSigningSecret;
    }

    public void setWebhookSigningSecret(String webhookSigningSecret) {
        this.webhookSigningSecret = webhookSigningSecret;
    }

    public boolean hasCredentials() {
        return apiBaseUrl != null && !apiBaseUrl.isBlank()
                && oauthTokenUrl != null && !oauthTokenUrl.isBlank()
                && clientId != null && !clientId.isBlank()
                && clientSecret != null && !clientSecret.isBlank();
    }
}
