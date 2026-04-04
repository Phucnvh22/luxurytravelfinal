package com.luxurytravel.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final String[] allowedOrigins;

    public WebConfig(@Value("${application.cors.allowed-origins:http://localhost:5173}") String allowedOrigins) {
        this.allowedOrigins = Arrays.stream(allowedOrigins.split(","))
                .map(WebConfig::normalizeOrigin)
                .filter(s -> !s.isEmpty())
                .toArray(String[]::new);
    }

    private static String normalizeOrigin(String origin) {
        if (origin == null) {
            return "";
        }
        String s = origin.trim();
        if (s.length() >= 2) {
            char first = s.charAt(0);
            char last = s.charAt(s.length() - 1);
            if ((first == '`' && last == '`') || (first == '"' && last == '"') || (first == '\'' && last == '\'')) {
                s = s.substring(1, s.length() - 1).trim();
            }
        }
        s = s.replace("`", "").trim();
        return s;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins)
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
    }
}
