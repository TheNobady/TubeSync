package com.tubesync.backend.domain;

import com.tubesync.backend.domain.role.HostRole;
import com.tubesync.backend.domain.role.ModeratorRole;
import com.tubesync.backend.dto.ParticipantDto;
import com.tubesync.backend.dto.VideoStateDto;
import com.tubesync.backend.dto.RoomStateDto;
import com.tubesync.backend.enums.RoleType;
import lombok.Getter;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Central synchronization hub for a single watch room.
 * Pure domain object — no Spring dependencies.
 * All mutation methods are synchronized on `this` to be thread-safe.
 */
@Getter
public class WatchRoom {

    private final String roomId;
    private final String roomCode;

    // Ordered by join time for host auto-promotion
    private final Map<String, ActiveParticipant> participants = new ConcurrentHashMap<>();
    private VideoState videoState = new VideoState();

    public WatchRoom(String roomId, String roomCode) {
        this.roomId = roomId;
        this.roomCode = roomCode;
    }

    // ── Participant management ────────────────────────────────────────────────

    public synchronized void addParticipant(ActiveParticipant participant) {
        participants.put(participant.getUserId(), participant);
    }

    /**
     * Remove a participant. If they were the host, auto-promote the next
     * eligible participant (oldest moderator → oldest participant → close).
     * Returns true if the room should be closed (no participants left).
     */
    public synchronized boolean removeParticipant(String userId) {
        ActiveParticipant leaving = participants.remove(userId);

        if (participants.isEmpty()) {
            return true; // signal room closure
        }

        if (leaving != null && leaving.getRole().getRoleType() == RoleType.HOST) {
            autoPromoteNewHost();
        }

        return false;
    }

    private void autoPromoteNewHost() {
        // 1. Find oldest moderator
        Optional<ActiveParticipant> nextHost = participants.values().stream()
                .filter(p -> p.getRole().getRoleType() == RoleType.MODERATOR)
                .min(Comparator.comparingLong(ActiveParticipant::getJoinedAt));

        // 2. Fall back to oldest participant
        if (nextHost.isEmpty()) {
            nextHost = participants.values().stream()
                    .min(Comparator.comparingLong(ActiveParticipant::getJoinedAt));
        }

        nextHost.ifPresent(p -> p.setRole(new HostRole()));
    }

    // ── Role management ───────────────────────────────────────────────────────

    public synchronized boolean promoteToModerator(String actorId, String targetId) {
        ActiveParticipant actor = participants.get(actorId);
        ActiveParticipant target = participants.get(targetId);
        if (actor == null || target == null) return false;
        if (!actor.getRole().canManageRoles()) return false;
        target.setRole(new ModeratorRole());
        return true;
    }

    public synchronized boolean demoteToParticipant(String actorId, String targetId) {
        ActiveParticipant actor = participants.get(actorId);
        ActiveParticipant target = participants.get(targetId);
        if (actor == null || target == null) return false;
        if (!actor.getRole().canManageRoles()) return false;
        if (target.getRole().getRoleType() == RoleType.HOST) return false; // can't demote host
        target.setRole(new com.tubesync.backend.domain.role.ParticipantRole());
        return true;
    }

    /**
     * Kicks a participant. Returns the kicked userId on success, null if the
     * operation is not permitted or the target doesn't exist.
     */
    public synchronized String kickParticipant(String actorId, String targetId) {
        ActiveParticipant actor = participants.get(actorId);
        if (actor == null || !actor.getRole().canKick()) return null;
        if (actorId.equals(targetId)) return null; // can't kick self
        ActiveParticipant removed = participants.remove(targetId);
        return removed != null ? targetId : null;
    }

    /** HOST only: silence a participant/mod by making them a read-only VIEWER. */
    public synchronized boolean demoteToViewer(String actorId, String targetId) {
        ActiveParticipant actor = participants.get(actorId);
        ActiveParticipant target = participants.get(targetId);
        if (actor == null || target == null) return false;
        if (!actor.getRole().canManageRoles()) return false;
        if (target.getRole().getRoleType() == RoleType.HOST) return false;
        target.setRole(new com.tubesync.backend.domain.role.ViewerRole());
        return true;
    }

    /** HOST only: restore a VIEWER back to a regular PARTICIPANT. */
    public synchronized boolean restoreToParticipant(String actorId, String targetId) {
        ActiveParticipant actor = participants.get(actorId);
        ActiveParticipant target = participants.get(targetId);
        if (actor == null || target == null) return false;
        if (!actor.getRole().canManageRoles()) return false;
        if (target.getRole().getRoleType() != RoleType.VIEWER) return false;
        target.setRole(new com.tubesync.backend.domain.role.ParticipantRole());
        return true;
    }

    // ── Video state mutations ─────────────────────────────────────────────────

    public synchronized boolean applyAction(String actorId, com.tubesync.backend.dto.ClientActionDto action) {
        ActiveParticipant actor = participants.get(actorId);
        if (actor == null) return false;
        if (!actor.getRole().canControlPlayback()) return false;

        switch (action.getType()) {
            case PLAY   -> videoState.setPlaying(true);
            case PAUSE  -> videoState.setPlaying(false);
            case SEEK   -> {
                if (action.getTimestamp() != null) videoState.setTimestamp(action.getTimestamp());
                if (action.getSpeed() != null)     videoState.setSpeed(action.getSpeed());
            }
            case CHANGE_VIDEO -> {
                if (action.getVideoId() != null) {
                    videoState.setVideoId(action.getVideoId());
                    videoState.setTimestamp(0.0);
                    videoState.setPlaying(true);
                }
            }
            default -> { return false; }
        }
        return true;
    }

    // ── State snapshot ────────────────────────────────────────────────────────

    public RoomStateDto buildStateSnapshot(RoomStateDto.EventType eventType) {
        VideoStateDto vDto = new VideoStateDto(
                videoState.getVideoId(),
                videoState.getTimestamp(),
                videoState.getSpeed(),
                videoState.isPlaying()
        );

        List<ParticipantDto> pDtos = participants.values().stream()
                .map(p -> new ParticipantDto(
                        p.getUserId(),
                        p.getDisplayName(),
                        p.getUser().getEmail(),
                        p.getRole().getRoleType()
                ))
                .collect(Collectors.toList());

        return new RoomStateDto(roomId, vDto, pDtos, eventType, null);
    }

    /**
     * Builds a KICKED snapshot that carries the kicked userId for the
     * personal directed broadcast.
     */
    public RoomStateDto buildKickedSnapshot(String kickedUserId) {
        RoomStateDto dto = buildStateSnapshot(RoomStateDto.EventType.KICKED);
        dto.setKickedUserId(kickedUserId);
        return dto;
    }
}
