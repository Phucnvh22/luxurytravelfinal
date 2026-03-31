package com.luxurytravel.backend.common;

import java.time.Instant;
import java.util.Map;

public class ApiError {
    private String message;
    private Instant timestamp;
    private Map<String, String> fields;

    public ApiError() {
    }

    public ApiError(String message, Instant timestamp, Map<String, String> fields) {
        this.message = message;
        this.timestamp = timestamp;
        this.fields = fields;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }

    public Map<String, String> getFields() {
        return fields;
    }

    public void setFields(Map<String, String> fields) {
        this.fields = fields;
    }
}
