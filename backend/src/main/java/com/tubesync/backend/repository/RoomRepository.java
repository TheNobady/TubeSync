package com.tubesync.backend.repository;

import com.tubesync.backend.entity.Room;
import com.tubesync.backend.enums.RoomStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface RoomRepository extends JpaRepository<Room, UUID> {
    Optional<Room> findByCode(String code);
    Optional<Room> findByCodeAndStatus(String code, RoomStatus status);
}
