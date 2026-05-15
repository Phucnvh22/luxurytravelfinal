package com.luxurytravel.backend.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class WhatsappOtpRequest {
    @NotBlank
    @Pattern(regexp = "^\\+?[0-9]{8,15}$")
    private String phoneNumber;

    @NotBlank
    private String fullName;

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }
}
