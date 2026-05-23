package com.tubesync.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * The single unified state object broadcast to all room participants
 * whenever any mutation occurs. Clients replace their entire local state
 * with this payload — no partial delta updates.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RoomStateDto {

    public enum EventType {
        STATE_UPDATE,
        USER_JOINED,
        USER_LEFT,
        ROLE_CHANGED,
        ROOM_CLOSED,
        KICKED
    }

    private String roomId;
    private VideoStateDto videoState;
    private List<ParticipantDto> participants;
    private EventType event;

    /** Populated only for KICKED events — the userId that was removed. */
    private String kickedUserId;
}
