package com.luxurytravel.backend.auth;

import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

@Service
public class WhatsappOtpService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final long EXPIRE_SECONDS = 300;
    private static final long RESEND_COOLDOWN_SECONDS = 30;
    private static final int MAX_ATTEMPTS = 5;

    private final Map<String, OtpEntry> otpStore = new ConcurrentHashMap<>();

    public String createOtp(String phoneNumber) {
        OtpEntry existing = otpStore.get(phoneNumber);
        if (existing != null && Instant.now().isBefore(existing.expiresAt()) && Instant.now().isBefore(existing.lastSentAt().plusSeconds(RESEND_COOLDOWN_SECONDS))) {
            throw new ResponseStatusException(BAD_REQUEST, "Please wait before requesting another OTP");
        }
        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        Instant now = Instant.now();
        otpStore.put(phoneNumber, new OtpEntry(code, now.plusSeconds(EXPIRE_SECONDS), now, 0));
        return code;
    }

    public void verifyOtp(String phoneNumber, String otp) {
        OtpEntry entry = otpStore.get(phoneNumber);
        if (entry == null) {
            throw new ResponseStatusException(BAD_REQUEST, "OTP not requested");
        }
        if (Instant.now().isAfter(entry.expiresAt())) {
            otpStore.remove(phoneNumber);
            throw new ResponseStatusException(BAD_REQUEST, "OTP expired");
        }
        if (entry.attempts() >= MAX_ATTEMPTS) {
            otpStore.remove(phoneNumber);
            throw new ResponseStatusException(BAD_REQUEST, "OTP blocked due to too many attempts");
        }
        if (!entry.code().equals(otp)) {
            otpStore.put(phoneNumber, new OtpEntry(entry.code(), entry.expiresAt(), entry.lastSentAt(), entry.attempts() + 1));
            throw new ResponseStatusException(BAD_REQUEST, "Invalid OTP");
        }
        otpStore.remove(phoneNumber);
    }

    private record OtpEntry(String code, Instant expiresAt, Instant lastSentAt, int attempts) {}
}
