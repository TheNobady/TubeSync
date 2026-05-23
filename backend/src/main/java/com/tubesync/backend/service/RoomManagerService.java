package com.tubesync.backend.service;

import com.tubesync.backend.domain.ActiveParticipant;
import com.tubesync.backend.domain.WatchRoom;
import com.tubesync.backend.domain.role.HostRole;
import com.tubesync.backend.domain.role.ParticipantRole;
import com.tubesync.backend.dto.ClientActionDto;
import com.tubesync.backend.dto.RoomStateDto;
import com.tubesync.backend.entity.Room;
import com.tubesync.backend.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Singleton service holding all active WatchRoom instances in a
 * ConcurrentHashMap keyed by roomId (UUID string).
 *
 * This is the single point of coordination between WebSocket events
 * and the in-memory room state. Never touches the database — that's
 * RoomService's job.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RoomManagerService {

    private final SimpMessagingTemplate messagingTemplate;
    private final RoomService roomService;

    // roomId (UUID) → WatchRoom
    private final ConcurrentHashMap<String, WatchRoom> activeRooms = new ConcurrentHashMap<>();

    // ── Room lifecycle ────────────────────────────────────────────────────────

    public WatchRoom createRoom(Room dbRoom, User creator, String displayName) {
        WatchRoom room = new WatchRoom(dbRoom.getId().toString(), dbRoom.getCode());
        ActiveParticipant host = new ActiveParticipant(creator, displayName, new HostRole());
        room.addParticipant(host);
        activeRooms.put(room.getRoomId(), room);
        log.info("Room created: {} (code={})", room.getRoomId(), room.getRoomCode());
        return room;
    }

    public WatchRoom joinRoom(String roomId, User user, String displayName) {
        WatchRoom room = getRoom(roomId);
        ActiveParticipant participant = new ActiveParticipant(user, displayName, new ParticipantRole());
        room.addParticipant(participant);
        broadcast(room, RoomStateDto.EventType.USER_JOINED);
        return room;
    }

    /**
     * Called when a WebSocket session disconnects.
     * Handles host auto-promotion and room closure.
     */
    public void leaveRoom(String roomId, String userId) {
        WatchRoom room = activeRooms.get(roomId);
        if (room == null) return;

        boolean shouldClose = room.removeParticipant(userId);

        if (shouldClose) {
            activeRooms.remove(roomId);
            roomService.closeRoom(roomId);
            log.info("Room closed (empty): {}", roomId);
            // Broadcast closure before removing
            broadcast(roomId, room, RoomStateDto.EventType.ROOM_CLOSED);
        } else {
            broadcast(room, RoomStateDto.EventType.USER_LEFT);
        }
    }

    // ── Action handling ───────────────────────────────────────────────────────

    public void handleAction(String roomId, String userId, ClientActionDto action) {
        WatchRoom room = getRoom(roomId);

        switch (action.getType()) {
            case PLAY, PAUSE, SEEK, CHANGE_VIDEO -> {
                boolean applied = room.applyAction(userId, action);
                if (applied) broadcast(room, RoomStateDto.EventType.STATE_UPDATE);
            }
            case PROMOTE -> {
                boolean done = room.promoteToModerator(userId, action.getTargetUserId());
                if (done) broadcast(room, RoomStateDto.EventType.ROLE_CHANGED);
            }
            case DEMOTE -> {
                boolean done = room.demoteToParticipant(userId, action.getTargetUserId());
                if (done) broadcast(room, RoomStateDto.EventType.ROLE_CHANGED);
            }
            case KICK -> {
                String kickedId = room.kickParticipant(userId, action.getTargetUserId());
                if (kickedId != null) {
                    // 1. Notify the kicked user personally so they can redirect
                    RoomStateDto kickedMsg = room.buildKickedSnapshot(kickedId);
                    messagingTemplate.convertAndSend(
                            "/topic/room/" + roomId + "/user/" + kickedId, kickedMsg);
                    // 2. Broadcast updated participant list to the whole room
                    broadcast(room, RoomStateDto.EventType.USER_LEFT);
                    log.info("User {} kicked from room {} by {}", kickedId, roomId, userId);
                }
            }
            case MAKE_VIEWER -> {
                boolean done = room.demoteToViewer(userId, action.getTargetUserId());
                if (done) broadcast(room, RoomStateDto.EventType.ROLE_CHANGED);
            }
            case RESTORE_PARTICIPANT -> {
                boolean done = room.restoreToParticipant(userId, action.getTargetUserId());
                if (done) broadcast(room, RoomStateDto.EventType.ROLE_CHANGED);
            }
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public WatchRoom getRoom(String roomId) {
        WatchRoom room = activeRooms.get(roomId);
        if (room == null) throw new com.tubesync.backend.exception.RoomNotFoundException(roomId);
        return room;
    }

    public boolean roomExists(String roomId) {
        return activeRooms.containsKey(roomId);
    }

    /**
     * Sends the full current room state to /topic/room/{roomId}.
     * All clients replace their local state with this payload entirely.
     */
    private void broadcast(WatchRoom room, RoomStateDto.EventType event) {
        broadcast(room.getRoomId(), room, event);
    }

    private void broadcast(String roomId, WatchRoom room, RoomStateDto.EventType event) {
        RoomStateDto state = room.buildStateSnapshot(event);
        messagingTemplate.convertAndSend("/topic/room/" + roomId, state);
        log.debug("Broadcast {} to room {}", event, roomId);
    }

    /**
     * Called by RoomReaperService. Scans active rooms and removes any that
     * have zero participants (missed disconnect events).
     * @return number of rooms evicted
     */
    public int evictEmptyRooms() {
        int count = 0;
        for (Map.Entry<String, WatchRoom> entry : new java.util.ArrayList<>(activeRooms.entrySet())) {
            if (entry.getValue().getParticipants().isEmpty()) {
                activeRooms.remove(entry.getKey());
                roomService.closeRoom(entry.getKey());
                log.info("Reaper: evicted empty room {}", entry.getKey());
                count++;
            }
        }
        return count;
    }
}
