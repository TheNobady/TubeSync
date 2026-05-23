package com.tubesync.backend.repository;

import com.tubesync.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByGoogleUid(String googleUid);
    Optional<User> findByEmail(String email);
}
