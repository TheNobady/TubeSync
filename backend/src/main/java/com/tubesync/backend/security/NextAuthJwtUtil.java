package com.tubesync.backend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;

/**
 * Validates and parses the HS256-signed JWT that NextAuth issues.
 *
 * NextAuth v4 default behaviour is JWE (encrypted). We override this on the
 * frontend with a custom encode/decode that produces a standard HS256 JWS,
 * so Spring Boot can verify it using the shared NEXTAUTH_SECRET.
 */
@Component
public class NextAuthJwtUtil {

    private final SecretKey signingKey;

    public NextAuthJwtUtil(@Value("${app.nextauth.secret}") String secret) {
        // NextAuth encodes the secret as UTF-8 bytes
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Parse and validate the JWT. Returns the claims if valid.
     * Throws JwtException or IllegalArgumentException on failure.
     */
    public Claims validateAndExtract(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String extractGoogleUid(String token) {
        return validateAndExtract(token).getSubject(); // 'sub' = google uid
    }

    public String extractEmail(String token) {
        return (String) validateAndExtract(token).get("email");
    }

    public boolean isValid(String token) {
        try {
            validateAndExtract(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }
}
