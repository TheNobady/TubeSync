package com.tubesync.backend.service;

import com.tubesync.backend.domain.ActiveParticipant;
import com.tubesync.backend.domain.WatchRoom;
import com.tubesync.backend.dto.ChatMessageDto;
import com.tubesync.backend.entity.ChatMessage;
import com.tubesync.backend.entity.User;
import com.tubesync.backend.repository.ChatMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatService {

    private static final int HISTORY_LIMIT = 50;
    private static final int MAX_CONTENT_LENGTH = 1000;

    private final ChatMessageRepository chatMessageRepository;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Validates, persists, and broadcasts a chat message.
     *
     * @param room     the active WatchRoom (used to check the sender is a member)
     * @param sender   the User entity of the sender
     * @param content  raw message text from the client
     * @return the saved ChatMessageDto, or null if rejected
     */
    @Transactional
    public ChatMessageDto sendMessage(WatchRoom room, User sender, String content) {
        // ── Validate ─────────────────────────────────────────────
        if (content == null || content.isBlank()) return null;

        String trimmed = content.trim();
        if (trimmed.length() > MAX_CONTENT_LENGTH) {
            trimmed = trimmed.substring(0, MAX_CONTENT_LENGTH);
        }

        // Viewers cannot chat
        ActiveParticipant participant = room.getParticipants().get(sender.getId().toString());
        if (participant == null) return null;
        if (!participant.getRole().canChat()) return null;

        // ── Persist ───────────────────────────────────────────────
        ChatMessage saved = chatMessageRepository.save(
                ChatMessage.builder()
                        .roomId(UUID.fromString(room.getRoomId()))
                        .sender(sender)
                        .displayName(participant.getDisplayName())
                        .content(trimmed)
                        .build()
        );

        ChatMessageDto dto = toDto(saved);

        // ── Broadcast ─────────────────────────────────────────────
        messagingTemplate.convertAndSend("/topic/room/" + room.getRoomId() + "/chat", dto);
        log.debug("Chat [room={}] {}: {}", room.getRoomId(), participant.getDisplayName(), trimmed);

        return dto;
    }

    /**
     * Returns the last {@value HISTORY_LIMIT} messages for a room, oldest-first.
     * Used by the frontend on connect to populate chat history.
     */
    @Transactional(readOnly = true)
    public List<ChatMessageDto> getHistory(String roomId) {
        return chatMessageRepository
                .findRecentByRoomId(UUID.fromString(roomId), HISTORY_LIMIT)
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    // ── Mapper ────────────────────────────────────────────────────────────────

    private ChatMessageDto toDto(ChatMessage msg) {
        return new ChatMessageDto(
                msg.getId().toString(),
                msg.getRoomId().toString(),
                msg.getSender().getId().toString(),
                msg.getDisplayName(),
                msg.getContent(),
                msg.getSentAt()
        );
    }
}
