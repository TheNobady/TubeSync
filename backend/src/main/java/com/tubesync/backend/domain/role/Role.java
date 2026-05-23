package com.tubesync.backend.domain.role;

import com.tubesync.backend.enums.RoleType;

/**
 * Strategy interface for participant roles.
 * Swap the injected Role object at runtime to promote/demote without
 * destroying the ActiveParticipant session.
 */
public interface Role {
    /** Can this role pause, play, seek, or change the video? */
    boolean canControlPlayback();

    /** Can this role promote or demote other participants? */
    boolean canManageRoles();

    /** Can this role kick participants? */
    boolean canKick();

    /** Can this role send chat messages? (VIEWER cannot) */
    boolean canChat();

    /** The canonical enum value for serialization in broadcasts. */
    RoleType getRoleType();
}
