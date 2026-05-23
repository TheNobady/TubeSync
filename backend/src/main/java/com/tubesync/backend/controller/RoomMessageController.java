package com.tubesync.backend.controller;

import com.tubesync.backend.dto.ClientActionDto;
import com.tubesync.backend.dto.SendMessageRequest;
import com.tubesync.backend.service.ChatService;
import com.tubesync.backend.service.RoomManagerService;
import com.tubesync.backend.service.UserService;
import com.tubesync.backend.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

/**
 * Handles all inbound STOMP messages from clients.
 *
 * Message flow:
 *   Client → /app/room/{roomId}/action → handleAction()
 *   Server → /topic/room/{roomId}      (broadcast via RoomManagerService)
 *
 * User identity is resolved from the WS session attributes set during the
 * JWT handshake interceptor — no per-message token overhead.
 */
@Slf4j
@Controller
@RequiredArgsConstructor
public class RoomMessageController {

    private final RoomManagerService roomManagerService;
    private final UserService userService;
    private final ChatService chatService;

    @MessageMapping("/room/{roomId}/action")
    public void handleAction(
            @DestinationVariable String roomId,
            @Payload ClientActionDto action,
            SimpMessageHeaderAccessor headerAccessor
    ) {
        String googleUid = (String) headerAccessor.getSessionAttributes().get("googleUid");
        if (googleUid == null) {
            log.warn("Unauthenticated STOMP message rejected for room {}", roomId);
            return;
        }

        try {
            User user = userService.getByGoogleUid(googleUid);
            roomManagerService.handleAction(roomId, user.getId().toString(), action);
        } catch (Exception e) {
            log.error("Error handling action {} in room {}: {}", action.getType(), roomId, e.getMessage());
        }
    }

    /**
     * Called when a client explicitly sends a DISCONNECT frame or their
     * session drops. Triggers host auto-promotion or room closure.
     */
    @MessageMapping("/room/{roomId}/leave")
    public void handleLeave(
            @DestinationVariable String roomId,
            SimpMessageHeaderAccessor headerAccessor
    ) {
        String googleUid = (String) headerAccessor.getSessionAttributes().get("googleUid");
        if (googleUid == null) return;

        try {
            User user = userService.getByGoogleUid(googleUid);
            roomManagerService.leaveRoom(roomId, user.getId().toString());
        } catch (Exception e) {
            log.error("Error on leave for room {}: {}", roomId, e.getMessage());
        }
    }

    /**
     * Handles a chat message sent to /app/room/{roomId}/chat.
     * Delegates to ChatService for validation, persistence, and broadcast.
     */
    @MessageMapping("/room/{roomId}/chat")
    public void handleChat(
            @DestinationVariable String roomId,
            @Payload SendMessageRequest request,
            SimpMessageHeaderAccessor headerAccessor
    ) {
        String googleUid = (String) headerAccessor.getSessionAttributes().get("googleUid");
        if (googleUid == null) return;

        try {
            User user = userService.getByGoogleUid(googleUid);
            var room = roomManagerService.getRoom(roomId);
            chatService.sendMessage(room, user, request.getContent());
        } catch (Exception e) {
            log.error("Error handling chat in room {}: {}", roomId, e.getMessage());
        }
    }
}
