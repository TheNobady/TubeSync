package com.tubesync.backend.domain;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Volatile in-memory representation of the current video playback state.
 * Never persisted to the database.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VideoState {

    private String videoId = "";
    private double timestamp = 0.0;
    private double speed = 1.0;
    private boolean isPlaying = false;
}
