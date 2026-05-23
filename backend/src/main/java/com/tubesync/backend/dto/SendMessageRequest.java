package com.tubesync.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Inbound STOMP payload for /app/room/{roomId}/chat
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SendMessageRequest {
    private String content;
}
