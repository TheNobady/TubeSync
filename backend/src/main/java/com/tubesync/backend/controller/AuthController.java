package com.tubesync.backend.controller;

import com.tubesync.backend.entity.User;
import com.tubesync.backend.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Called by Next.js immediately after Google OAuth sign-in to sync the
 * authenticated user into the PostgreSQL users table.
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;

    @PostMapping("/sync")
    public ResponseEntity<Map<String, String>> syncUser(
            @RequestBody Map<String, String> body
    ) {
        String googleUid   = body.get("googleUid");
        String email       = body.get("email");
        String displayName = body.get("displayName");
        String avatarUrl   = body.get("avatarUrl");

        if (googleUid == null || email == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing required fields"));
        }

        User user = userService.upsertUser(googleUid, email, displayName, avatarUrl);

        return ResponseEntity.ok(Map.of(
                "userId",    user.getId().toString(),
                "googleUid", user.getGoogleUid(),
                "email",     user.getEmail()
        ));
    }
}
