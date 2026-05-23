package com.tubesync.backend.repository;

import com.tubesync.backend.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, UUID> {

    /**
     * Returns the last {@code limit} messages for a room, ordered oldest→newest.
     * Uses a sub-select to grab the latest N then re-orders for display.
     */
    @Query(value = """
        SELECT * FROM (
            SELECT * FROM chat_messages
            WHERE room_id = :roomId
            ORDER BY sent_at DESC
            LIMIT :limit
        ) sub
        ORDER BY sub.sent_at ASC
        """, nativeQuery = true)
    List<ChatMessage> findRecentByRoomId(
            @Param("roomId") UUID roomId,
            @Param("limit") int limit
    );
}
