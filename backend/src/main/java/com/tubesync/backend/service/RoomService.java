package com.tubesync.backend.service;

import com.tubesync.backend.entity.Room;
import com.tubesync.backend.entity.User;
import com.tubesync.backend.enums.RoomStatus;
import com.tubesync.backend.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;

@Service
@RequiredArgsConstructor
public class RoomService {

    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
    private static final SecureRandom RANDOM = new SecureRandom();

    private final RoomRepository roomRepository;

    @Transactional
    public Room createRoom(User creator) {
        String code = generateUniqueCode();
        Room room = Room.builder()
                .code(code)
                .creator(creator)
                .status(RoomStatus.ACTIVE)
                .build();
        return roomRepository.save(room);
    }

    @Transactional(readOnly = true)
    public Room getActiveRoomByCode(String code) {
        return roomRepository.findByCodeAndStatus(code.toUpperCase(), RoomStatus.ACTIVE)
                .orElseThrow(() -> new com.tubesync.backend.exception.RoomNotFoundException(code));
    }

    @Transactional
    public void closeRoom(String roomId) {
        roomRepository.findById(java.util.UUID.fromString(roomId)).ifPresent(room -> {
            room.setStatus(RoomStatus.CLOSED);
            room.setClosedAt(Instant.now());
            roomRepository.save(room);
        });
    }

    private String generateUniqueCode() {
        String code;
        do {
            code = randomCode();
        } while (roomRepository.findByCode(code).isPresent());
        return code;
    }

    private String randomCode() {
        StringBuilder sb = new StringBuilder(6);
        for (int i = 0; i < 6; i++) {
            sb.append(CODE_CHARS.charAt(RANDOM.nextInt(CODE_CHARS.length())));
        }
        return sb.toString();
    }
}
