package com.tubesync.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * Persisted chat message inside a watch room.
 * Messages are stored per room and served as history to late joiners.
 */
@Entity
@Table(
    name = "chat_messages",
    indexes = {
        @Index(name = "idx_chat_room_sent", columnList = "room_id, sent_at")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** The room this message belongs to. */
    @Column(name = "room_id", nullable = false)
    private UUID roomId;

    /** The user who sent this message. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User sender;

    /**
     * Denormalized display name — stored at send time so it stays correct
     * even if the user changes their name later.
     */
    @Column(name = "display_name", nullable = false)
    private String displayName;

    @Column(nullable = false, length = 1000)
    private String content;

    @CreationTimestamp
    @Column(name = "sent_at", nullable = false, updatable = false)
    private Instant sentAt;
}
