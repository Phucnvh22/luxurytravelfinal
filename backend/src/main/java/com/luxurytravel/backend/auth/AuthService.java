package com.luxurytravel.backend.auth;

import com.luxurytravel.backend.security.JwtService;
import com.luxurytravel.backend.user.Role;
import com.luxurytravel.backend.user.User;
import com.luxurytravel.backend.user.UserRepository;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;

import java.security.SecureRandom;
import java.util.Locale;

@Service
public class AuthService {
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final WhatsappOtpService whatsappOtpService;
    private final WhatsappCloudApiService whatsappCloudApiService;

    public AuthService(UserRepository repository, PasswordEncoder passwordEncoder, JwtService jwtService, @Lazy AuthenticationManager authenticationManager, WhatsappOtpService whatsappOtpService, WhatsappCloudApiService whatsappCloudApiService) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
        this.whatsappOtpService = whatsappOtpService;
        this.whatsappCloudApiService = whatsappCloudApiService;
    }

    public AuthResponse register(RegisterRequest request) {
        if (repository.existsByUsername(request.getUsername())) {
            throw new ResponseStatusException(CONFLICT, "Username already exists");
        }

        User user = new User(
                request.getUsername(),
                request.getEmail(),
                passwordEncoder.encode(request.getPassword()),
                request.getFullName(),
                Role.USER // Default role is USER
        );
        repository.save(user);
        return issueAuthResponse(user);
    }

    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getUsername(),
                        request.getPassword()
                )
        );
        User user = repository.findByUsername(request.getUsername())
                .orElseThrow();
        return issueAuthResponse(user);
    }

    public AuthResponse socialLogin(SocialLoginRequest request) {
        String provider = request.getProvider().trim().toUpperCase(Locale.ROOT);
        String externalId = request.getExternalId().trim();
        String fullName = request.getFullName().trim();
        String email = request.getEmail() == null ? null : request.getEmail().trim().toLowerCase(Locale.ROOT);

        User user = upsertSocialUser(provider, externalId, email, fullName);
        return issueAuthResponse(user);
    }

    public AuthResponse loginByOAuth2Provider(String provider, String externalId, String email, String fullName) {
        User user = upsertSocialUser(provider, externalId, email, fullName);
        return issueAuthResponse(user);
    }

    public WhatsappOtpResponse requestWhatsappOtp(WhatsappOtpRequest request) {
        String normalizedPhone = normalizePhone(request.getPhoneNumber());
        String otp = whatsappOtpService.createOtp(normalizedPhone);
        whatsappCloudApiService.sendOtp(normalizedPhone, otp);
        return new WhatsappOtpResponse(true, "OTP sent via WhatsApp");
    }

    public AuthResponse verifyWhatsappOtp(WhatsappOtpVerifyRequest request) {
        String normalizedPhone = normalizePhone(request.getPhoneNumber());
        whatsappOtpService.verifyOtp(normalizedPhone, request.getOtp());
        User user = upsertSocialUser("WHATSAPP", normalizedPhone, null, request.getFullName().trim());
        return issueAuthResponse(user);
    }

    private AuthResponse issueAuthResponse(User user) {
        long currentSessionVersion = user.getSessionVersion() == null ? 0L : user.getSessionVersion();
        user.setSessionVersion(currentSessionVersion + 1L);
        User savedUser = repository.save(user);
        String jwtToken = jwtService.generateToken(savedUser);
        return new AuthResponse(
                jwtToken,
                savedUser.getId(),
                savedUser.getUsername(),
                savedUser.getEmail(),
                savedUser.getFullName(),
                savedUser.getRole()
        );
    }

    private User upsertSocialUser(String provider, String externalId, String email, String fullName) {
        User byProvider = repository.findByAuthProviderAndProviderUserId(provider, externalId).orElse(null);
        if (byProvider != null) {
            if (email != null && !email.isBlank() && (byProvider.getEmail() == null || byProvider.getEmail().isBlank())) {
                byProvider.setEmail(email);
            }
            if (fullName != null && !fullName.isBlank()) {
                byProvider.setFullName(fullName);
            }
            return repository.save(byProvider);
        }

        if (email != null && !email.isBlank()) {
            User existingByEmail = repository.findByEmail(email).orElse(null);
            if (existingByEmail != null) {
                if (existingByEmail.getAuthProvider() == null || existingByEmail.getProviderUserId() == null) {
                    existingByEmail.setAuthProvider(provider);
                    existingByEmail.setProviderUserId(externalId);
                    if (existingByEmail.getFullName() == null || existingByEmail.getFullName().isBlank()) {
                        existingByEmail.setFullName(fullName);
                    }
                    return repository.save(existingByEmail);
                }
                if (provider.equals(existingByEmail.getAuthProvider())
                        && externalId.equals(existingByEmail.getProviderUserId())) {
                    return existingByEmail;
                }
            }
        }

        String username = buildUniqueUsername(provider, email, externalId);
        User user = new User(
                username,
                email,
                passwordEncoder.encode(randomPassword()),
                fullName.isBlank() ? provider + " user" : fullName,
                Role.USER
        );
        user.setAuthProvider(provider);
        user.setProviderUserId(externalId);
        return repository.save(user);
    }

    private String normalizePhone(String phone) {
        String normalized = phone == null ? "" : phone.trim().replaceAll("[^0-9]", "");
        if (normalized.isBlank() || normalized.length() < 9 || normalized.length() > 15) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid phone number");
        }
        return normalized;
    }

    private String buildUniqueUsername(String provider, String email, String externalId) {
        String seed = (email != null && !email.isBlank()) ? email : externalId;
        String normalized = seed.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
        if (normalized.length() < 4) {
            normalized = normalized + Math.abs(normalized.hashCode());
        }
        String base = provider.toLowerCase(Locale.ROOT) + "_" + normalized.substring(0, Math.min(normalized.length(), 18));
        String candidate = base;
        int i = 1;
        while (repository.existsByUsername(candidate)) {
            candidate = base + i;
            i++;
        }
        return candidate;
    }

    private String randomPassword() {
        return Long.toHexString(RANDOM.nextLong()) + Long.toHexString(RANDOM.nextLong());
    }
}
