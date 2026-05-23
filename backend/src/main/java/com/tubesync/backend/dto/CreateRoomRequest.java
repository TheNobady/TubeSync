package com.tubesync.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateRoomRequest {
    @NotBlank
    @Size(min = 1, max = 50)
    private String displayName;
}
