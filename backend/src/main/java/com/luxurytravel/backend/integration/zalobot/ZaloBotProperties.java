package com.luxurytravel.backend.integration.zalobot;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.integrations.zalo-bot")
public class ZaloBotProperties {
    private boolean enabled = false;
    private String apiBaseUrl = "https://bot-api.zaloplatforms.com";
    private String token = "";
    private String webhookSecretToken = "";

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

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getWebhookSecretToken() {
        return webhookSecretToken;
    }

    public void setWebhookSecretToken(String webhookSecretToken) {
        this.webhookSecretToken = webhookSecretToken;
    }

    public boolean isReadyToSend() {
        return enabled
                && apiBaseUrl != null && !apiBaseUrl.isBlank()
                && token != null && !token.isBlank();
    }
}
