package com.tubesync.backend.domain;

import com.tubesync.backend.domain.role.Role;
import com.tubesync.backend.entity.User;
import lombok.Getter;
import lombok.Setter;

/**
 * Represents a live WebSocket session inside a room.
 * Holds a reference to the persistent User entity and an injected Role.
 * Promote/demote by calling setRole() — the session is preserved.
 */
@Getter
public class ActiveParticipant {

    private final User user;
    private final String displayName;
    private final long joinedAt;

    @Setter
    private Role role;

    public ActiveParticipant(User user, String displayName, Role role) {
        this.user = user;
        this.displayName = displayName;
        this.role = role;
        this.joinedAt = System.currentTimeMillis();
    }

    public String getUserId() {
        return user.getId().toString();
    }
}
