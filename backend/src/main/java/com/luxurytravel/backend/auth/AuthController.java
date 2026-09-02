package com.luxurytravel.backend.auth;

import com.luxurytravel.backend.user.User;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@RequestBody @Valid RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody @Valid LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/social-login")
    public ResponseEntity<AuthResponse> socialLogin(@RequestBody @Valid SocialLoginRequest request) {
        return ResponseEntity.ok(authService.socialLogin(request));
    }

    @PostMapping("/whatsapp/request-otp")
    public ResponseEntity<WhatsappOtpResponse> requestWhatsappOtp(@RequestBody @Valid WhatsappOtpRequest request) {
        return ResponseEntity.ok(authService.requestWhatsappOtp(request));
    }

    @PostMapping("/whatsapp/verify-otp")
    public ResponseEntity<AuthResponse> verifyWhatsappOtp(@RequestBody @Valid WhatsappOtpVerifyRequest request) {
        return ResponseEntity.ok(authService.verifyWhatsappOtp(request));
    }

    @GetMapping("/session")
    public ResponseEntity<Void> session(@AuthenticationPrincipal User user) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.noContent().build();
    }
}
