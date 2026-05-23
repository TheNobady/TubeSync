package com.tubesync.backend.service;

import com.tubesync.backend.entity.User;
import com.tubesync.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    /**
     * Upsert a user based on their Google UID.
     * Called on every login from the NextAuth signIn callback.
     */
    @Transactional
    public User upsertUser(String googleUid, String email, String displayName, String avatarUrl) {
        return userRepository.findByGoogleUid(googleUid)
                .map(existing -> {
                    // Update mutable fields on each login
                    if (displayName != null && !displayName.isBlank()) {
                        existing.setDisplayName(displayName);
                    }
                    existing.setAvatarUrl(avatarUrl);
                    return userRepository.save(existing);
                })
                .orElseGet(() -> userRepository.save(
                        User.builder()
                                .googleUid(googleUid)
                                .email(email)
                                .displayName(displayName)
                                .avatarUrl(avatarUrl)
                                .build()
                ));
    }

    public User getByGoogleUid(String googleUid) {
        return userRepository.findByGoogleUid(googleUid)
                .orElseThrow(() -> new RuntimeException("User not found: " + googleUid));
    }
}
