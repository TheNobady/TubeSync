package com.tubesync.backend.dto;

import com.tubesync.backend.enums.RoleType;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ParticipantDto {
    private String userId;
    private String displayName;
    private String email;
    private RoleType role;
}
