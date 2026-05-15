package com.luxurytravel.backend.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class WhatsappOtpVerifyRequest {
    @NotBlank
    @Pattern(regexp = "^\\+?[0-9]{8,15}$")
    private String phoneNumber;

    @NotBlank
    @Pattern(regexp = "^[0-9]{6}$")
    private String otp;

    @NotBlank
    private String fullName;

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public String getOtp() {
        return otp;
    }

    public void setOtp(String otp) {
        this.otp = otp;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }
}
