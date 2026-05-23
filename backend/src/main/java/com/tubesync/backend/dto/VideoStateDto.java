package com.tubesync.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VideoStateDto {
    private String videoId;
    private double timestamp;
    private double speed;
    private boolean isPlaying;
}
