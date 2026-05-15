package com.luxurytravel.backend.auth;

public class WhatsappOtpResponse {
    private boolean sent;
    private String message;

    public WhatsappOtpResponse(boolean sent, String message) {
        this.sent = sent;
        this.message = message;
    }

    public boolean isSent() {
        return sent;
    }

    public String getMessage() {
        return message;
    }
}
