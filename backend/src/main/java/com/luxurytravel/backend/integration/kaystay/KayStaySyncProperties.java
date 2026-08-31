package com.luxurytravel.backend.integration.kaystay;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

@ConfigurationProperties(prefix = "application.integrations.kaystay-sync")
public class KayStaySyncProperties {
    private boolean enabled = true;
    private boolean autoEnabled = false;
    private String baseUrl = "https://www.smartorder.ai";
    private String premierReviewCode = "93603c4163ce4f1391d095880377f759";
    private List<String> roomCodes = new ArrayList<>();
    private int horizonDays = 90;
    private long fixedDelayMs = 7_200_000L;
    private long initialDelayMs = 120_000L;
    private long timeoutMs = 15_000L;
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

    public String getPremierReviewCode() {
        return premierReviewCode;
    }

    public void setPremierReviewCode(String premierReviewCode) {
        this.premierReviewCode = premierReviewCode;
    }

    public List<String> getRoomCodes() {
        return roomCodes;
    }

    public void setRoomCodes(List<String> roomCodes) {
        this.roomCodes = roomCodes == null ? new ArrayList<>() : roomCodes;
    }

    public int getHorizonDays() {
        return horizonDays;
    }

    public void setHorizonDays(int horizonDays) {
        this.horizonDays = horizonDays;
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
