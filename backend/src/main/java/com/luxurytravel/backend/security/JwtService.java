package com.luxurytravel.backend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.security.Key;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

@Service
public class JwtService {

    @Value("${application.security.jwt.secret-key}")
    private String secretKey;

    @Value("${application.security.jwt.expiration}")
    private long jwtExpiration;

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    public String generateToken(UserDetails userDetails) {
        return generateToken(new HashMap<>(), userDetails);
    }

    public String generateToken(
            Map<String, Object> extraClaims,
            UserDetails userDetails
    ) {
        return buildToken(extraClaims, userDetails, jwtExpiration);
    }

    private String buildToken(
            Map<String, Object> extraClaims,
            UserDetails userDetails,
            long expiration
    ) {
        return Jwts
                .builder()
                .setClaims(extraClaims)
                .setSubject(userDetails.getUsername())
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(getSignInKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        final String username = extractUsername(token);
        return (username.equals(userDetails.getUsername())) && !isTokenExpired(token);
    }

    private boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    private Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    private Claims extractAllClaims(String token) {
        return Jwts
                .parserBuilder()
                .setSigningKey(getSignInKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    private Key getSignInKey() {
        byte[] keyBytes = resolveKeyBytes(secretKey);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    private static byte[] resolveKeyBytes(String configuredSecret) {
        String secret = configuredSecret == null ? "" : configuredSecret.trim();

        byte[] base64 = tryDecodeBase64(secret);
        if (base64 != null && base64.length >= 32) {
            return base64;
        }

        byte[] base64Url = tryDecodeBase64Url(secret);
        if (base64Url != null && base64Url.length >= 32) {
            return base64Url;
        }

        byte[] hex = tryDecodeHex(secret);
        if (hex != null && hex.length >= 32) {
            return hex;
        }

        byte[] raw = secret.getBytes(StandardCharsets.UTF_8);
        if (raw.length >= 32) {
            return raw;
        }

        return sha256(raw);
    }

    private static byte[] tryDecodeBase64(String secret) {
        if (secret == null || secret.isBlank()) {
            return null;
        }
        try {
            return Decoders.BASE64.decode(secret);
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private static byte[] tryDecodeBase64Url(String secret) {
        if (secret == null || secret.isBlank()) {
            return null;
        }
        try {
            return Decoders.BASE64URL.decode(secret);
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private static byte[] tryDecodeHex(String secret) {
        if (secret == null || secret.isBlank()) {
            return null;
        }
        if ((secret.length() % 2) != 0) {
            return null;
        }
        for (int i = 0; i < secret.length(); i++) {
            char c = secret.charAt(i);
            boolean isHexDigit = (c >= '0' && c <= '9')
                    || (c >= 'a' && c <= 'f')
                    || (c >= 'A' && c <= 'F');
            if (!isHexDigit) {
                return null;
            }
        }

        byte[] out = new byte[secret.length() / 2];
        for (int i = 0; i < out.length; i++) {
            int hi = Character.digit(secret.charAt(i * 2), 16);
            int lo = Character.digit(secret.charAt(i * 2 + 1), 16);
            out[i] = (byte) ((hi << 4) + lo);
        }
        return out;
    }

    private static byte[] sha256(byte[] input) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(input);
        } catch (Exception e) {
            throw new IllegalStateException("Unable to derive JWT key bytes", e);
        }
    }
}
