package com.tubesync.backend.controller;

import com.tubesync.backend.domain.WatchRoom;
import com.tubesync.backend.dto.ChatMessageDto;
import com.tubesync.backend.dto.CreateRoomRequest;
import com.tubesync.backend.dto.JoinRoomRequest;
import com.tubesync.backend.entity.Room;
import com.tubesync.backend.entity.User;
import com.tubesync.backend.service.ChatService;
import com.tubesync.backend.service.RoomManagerService;
import com.tubesync.backend.service.RoomService;
import com.tubesync.backend.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomService roomService;
    private final RoomManagerService roomManagerService;
    private final UserService userService;
    private final ChatService chatService;

    /**
     * POST /api/rooms/create
     * Creates a DB room record + activates it in RoomManagerService as the host.
     */
    @PostMapping("/create")
    public ResponseEntity<Map<String, String>> createRoom(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody CreateRoomRequest request
    ) {
        Room dbRoom = roomService.createRoom(currentUser);
        WatchRoom activeRoom = roomManagerService.createRoom(dbRoom, currentUser, request.getDisplayName());

        return ResponseEntity.ok(Map.of(
                "roomId",   activeRoom.getRoomId(),
                "roomCode", activeRoom.getRoomCode()
        ));
    }

    /**
     * POST /api/rooms/join
     * Looks up room by code, validates it's active, and adds user as participant.
     */
    @PostMapping("/join")
    public ResponseEntity<Map<String, String>> joinRoom(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody JoinRoomRequest request
    ) {
        // 1. Validate the room exists and is active in DB
        Room dbRoom = roomService.getActiveRoomByCode(request.getCode());
        String roomId = dbRoom.getId().toString();

        // 2. Join the in-memory room (auto-creates it if not yet active)
        if (!roomManagerService.roomExists(roomId)) {
            // Room exists in DB but no one is connected yet (e.g. server restart).
            // Re-create the in-memory state. The first person to reconnect becomes
            // the new host — this is intentional "claim host on reconnect" semantics.
            roomManagerService.createRoom(dbRoom, currentUser, request.getDisplayName());
        } else {
            roomManagerService.joinRoom(roomId, currentUser, request.getDisplayName());
        }

        return ResponseEntity.ok(Map.of(
                "roomId",   roomId,
                "roomCode", dbRoom.getCode()
        ));
    }

    /**
     * GET /api/rooms/{roomId}/state
     * Returns the current room state for late-joining clients.
     */
    @GetMapping("/{roomId}/state")
    public ResponseEntity<?> getRoomState(@PathVariable String roomId) {
        if (!roomManagerService.roomExists(roomId)) {
            return ResponseEntity.notFound().build();
        }
        WatchRoom room = roomManagerService.getRoom(roomId);
        return ResponseEntity.ok(room.buildStateSnapshot(
                com.tubesync.backend.dto.RoomStateDto.EventType.STATE_UPDATE
        ));
    }
    /**
     * GET /api/rooms/code/{code}
     * Resolves a room code to its UUID — used by the frontend on page load.
     */
    @GetMapping("/code/{code}")
    public ResponseEntity<?> getRoomByCode(@PathVariable String code) {
        try {
            Room dbRoom = roomService.getActiveRoomByCode(code.toUpperCase());
            String roomId = dbRoom.getId().toString();
            // Return roomId + current state if active in memory
            if (roomManagerService.roomExists(roomId)) {
                return ResponseEntity.ok(Map.of(
                        "roomId",   roomId,
                        "roomCode", dbRoom.getCode(),
                        "active",   true
                ));
            }
            return ResponseEntity.ok(Map.of(
                    "roomId",   roomId,
                    "roomCode", dbRoom.getCode(),
                    "active",   false
            ));
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * GET /api/rooms/{roomId}/chat/history
     * Returns the last 50 chat messages for a room — loaded by the frontend
     * on WebSocket connect to populate the chat panel.
     */
    @GetMapping("/{roomId}/chat/history")
    public ResponseEntity<java.util.List<ChatMessageDto>> getChatHistory(@PathVariable String roomId) {
        // Validate UUID format before hitting the DB to avoid IllegalArgumentException
        try {
            java.util.UUID.fromString(roomId);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(chatService.getHistory(roomId));
    }
}
