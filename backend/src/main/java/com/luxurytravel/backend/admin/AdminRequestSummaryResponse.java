package com.luxurytravel.backend.admin;

public class AdminRequestSummaryResponse {
    private long pendingServiceRequests;
    private long pendingExperienceRequests;
    private Long latestServiceRequestId;
    private Long latestExperienceRequestId;

    public long getPendingServiceRequests() {
        return pendingServiceRequests;
    }

    public void setPendingServiceRequests(long pendingServiceRequests) {
        this.pendingServiceRequests = pendingServiceRequests;
    }

    public long getPendingExperienceRequests() {
        return pendingExperienceRequests;
    }

    public void setPendingExperienceRequests(long pendingExperienceRequests) {
        this.pendingExperienceRequests = pendingExperienceRequests;
    }

    public Long getLatestServiceRequestId() {
        return latestServiceRequestId;
    }

    public void setLatestServiceRequestId(Long latestServiceRequestId) {
        this.latestServiceRequestId = latestServiceRequestId;
    }

    public Long getLatestExperienceRequestId() {
        return latestExperienceRequestId;
    }

    public void setLatestExperienceRequestId(Long latestExperienceRequestId) {
        this.latestExperienceRequestId = latestExperienceRequestId;
    }

    public long getTotalPendingRequests() {
        return pendingServiceRequests + pendingExperienceRequests;
    }
}

