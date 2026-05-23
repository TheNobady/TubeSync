package com.tubesync.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Periodically checks for stale rooms — rooms that exist in the in-memory
 * map but have no WebSocket heartbeat or participants.
 *
 * This is a safety net in case WebSocket disconnect events are missed
 * (e.g., network drop without a clean STOMP DISCONNECT frame).
 *
 * Schedule: every 5 minutes.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RoomReaperService {

    private final RoomManagerService roomManagerService;

    @Scheduled(fixedDelay = 5 * 60 * 1000) // every 5 minutes
    public void evictEmptyRooms() {
        int evicted = roomManagerService.evictEmptyRooms();
        if (evicted > 0) {
            log.info("RoomReaper: evicted {} empty room(s)", evicted);
        }
    }
}
