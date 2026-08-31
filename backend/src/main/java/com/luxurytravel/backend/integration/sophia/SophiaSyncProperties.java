package com.luxurytravel.backend.integration.sophia;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.integrations.sophia-sync")
public class SophiaSyncProperties {
    private boolean enabled = true;
    private boolean autoEnabled = false;
    private String baseUrl = "https://app.sophiapms.com";
    private String companyId = "NjE3";
    private String userId = "d2cbc71f-0e2f-4c88-8896-c69fb71ff93f";
    private String username = "TA5";
    private String password = "123123";
    private int horizonDays = 31;
    private int viewDays = 31;
    private long fixedDelayMs = 7_200_000L;
    private long initialDelayMs = 120_000L;
    private long timeoutMs = 20_000L;
    private int blockCheckInHour = 15;
    private int blockCheckOutHour = 11;
    private String zoneId = "Asia/Ho_Chi_Minh";
    private String userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isAutoEnabled() {
        return autoEnabled;
    }

    public void setAutoEnabled(boolean autoEnabled) {
        this.autoEnabled = autoEnabled;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getCompanyId() {
        return companyId;
    }

    public void setCompanyId(String companyId) {
        this.companyId = companyId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public int getHorizonDays() {
        return horizonDays;
    }

    public void setHorizonDays(int horizonDays) {
        this.horizonDays = horizonDays;
    }

    public int getViewDays() {
        return viewDays;
    }

    public void setViewDays(int viewDays) {
        this.viewDays = viewDays;
    }

    public long getFixedDelayMs() {
        return fixedDelayMs;
    }

    public void setFixedDelayMs(long fixedDelayMs) {
        this.fixedDelayMs = fixedDelayMs;
    }

    public long getInitialDelayMs() {
        return initialDelayMs;
    }

    public void setInitialDelayMs(long initialDelayMs) {
        this.initialDelayMs = initialDelayMs;
    }

    public long getTimeoutMs() {
        return timeoutMs;
    }

    public void setTimeoutMs(long timeoutMs) {
        this.timeoutMs = timeoutMs;
    }

    public int getBlockCheckInHour() {
        return blockCheckInHour;
    }

    public void setBlockCheckInHour(int blockCheckInHour) {
        this.blockCheckInHour = blockCheckInHour;
    }

    public int getBlockCheckOutHour() {
        return blockCheckOutHour;
    }

    public void setBlockCheckOutHour(int blockCheckOutHour) {
        this.blockCheckOutHour = blockCheckOutHour;
    }

    public String getZoneId() {
        return zoneId;
    }

    public void setZoneId(String zoneId) {
        this.zoneId = zoneId;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public void setUserAgent(String userAgent) {
        this.userAgent = userAgent;
    }
}
