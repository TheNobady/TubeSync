package com.tubesync.backend.dto;

import lombok.Data;

/**
 * Incoming action from a client via STOMP /app/room/{roomId}/action.
 */
@Data
public class ClientActionDto {

    public enum ActionType {
        PLAY,
        PAUSE,
        SEEK,
        CHANGE_VIDEO,
        PROMOTE,    // PARTICIPANT → MOD
        DEMOTE,     // MOD → PARTICIPANT
        KICK,
        MAKE_VIEWER,         // PARTICIPANT/MOD → VIEWER (read-only)
        RESTORE_PARTICIPANT  // VIEWER → PARTICIPANT
    }

    private ActionType type;

    // For SEEK / CHANGE_VIDEO
    private Double timestamp;
    private String videoId;
    private Double speed;

    // For PROMOTE / DEMOTE / KICK — target user's UUID
    private String targetUserId;
}
