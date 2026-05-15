package com.luxurytravel.backend.security;

import com.luxurytravel.backend.auth.AuthResponse;
import com.luxurytravel.backend.auth.AuthService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;

@Component
public class OAuth2LoginSuccessHandler implements AuthenticationSuccessHandler {
    private final AuthService authService;

    @Value("${application.security.oauth2.frontend-redirect-base-url:http://localhost:5173}")
    private String frontendRedirectBaseUrl;

    public OAuth2LoginSuccessHandler(AuthService authService) {
        this.authService = authService;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication) throws IOException, ServletException {
        OAuth2AuthenticationToken oauthToken = (OAuth2AuthenticationToken) authentication;
        OAuth2User oauthUser = oauthToken.getPrincipal();

        String provider = oauthToken.getAuthorizedClientRegistrationId().toUpperCase(Locale.ROOT);
        String providerUserId = resolveProviderUserId(oauthUser);
        String email = getString(oauthUser.getAttributes(), "email");
        String fullName = getString(oauthUser.getAttributes(), "name");
        if (fullName == null || fullName.isBlank()) {
            fullName = provider + " user";
        }

        AuthResponse auth = authService.loginByOAuth2Provider(provider, providerUserId, email, fullName);
        String redirect = frontendRedirectBaseUrl
                + "/oauth2/success?token=" + encode(auth.getToken())
                + "&id=" + auth.getId()
                + "&username=" + encode(auth.getUsername())
                + "&fullName=" + encode(auth.getFullName())
                + "&role=" + auth.getRole()
                + "&email=" + encode(auth.getEmail() == null ? "" : auth.getEmail());
        response.sendRedirect(redirect);
    }

    private static String resolveProviderUserId(OAuth2User user) {
        Map<String, Object> attrs = user.getAttributes();
        String[] keys = {"sub", "id", "user_id"};
        for (String key : keys) {
            Object value = attrs.get(key);
            if (value != null && !value.toString().isBlank()) {
                return value.toString();
            }
        }
        return user.getName();
    }

    private static String getString(Map<String, Object> attrs, String key) {
        Object v = attrs.get(key);
        return v == null ? null : v.toString();
    }

    private static String encode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }
}
