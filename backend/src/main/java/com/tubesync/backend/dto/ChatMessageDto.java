package com.tubesync.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Outbound chat message broadcast to /topic/room/{roomId}/chat
 * and returned from the history REST endpoint.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessageDto {
    private String id;
    private String roomId;
    private String userId;
    private String displayName;
    private String content;
    private Instant sentAt;
}
