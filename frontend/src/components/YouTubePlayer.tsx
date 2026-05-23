"use client";

import { useEffect, useRef, useState, useCallback } from "react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export interface PlayerRef {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  setPlaybackRate: (rate: number) => void;
}

export const YT_PLAYER_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

interface YouTubePlayerProps {
  videoId: string;
  onReady?: (player: PlayerRef) => void;
  onStateChange?: (state: number, currentTime: number) => void;
  onError?: (code: number) => void;
  isSyncingRef: React.MutableRefObject<boolean>; // lock: true = ignore local events
}

export function YouTubePlayer({
  videoId,
  onReady,
  onStateChange,
  onError,
  isSyncingRef,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [apiReady, setApiReady] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load YouTube IFrame API ─────────────────────────────────
  useEffect(() => {
    if (window.YT?.Player) {
      setApiReady(true);
      return;
    }

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => setApiReady(true);

    return () => {
      // Don't remove script — it's singleton, reloading breaks things
    };
  }, []);

  // ── Initialize player once API is ready ────────────────────
  useEffect(() => {
    if (!apiReady || !containerRef.current) return;

    playerRef.current = new window.YT.Player(containerRef.current, {
      videoId,
      playerVars: {
        autoplay: 0,
        controls: 1,
        rel: 0,
        modestbranding: 1,
        iv_load_policy: 3,
        origin: window.location.origin,
      },
      events: {
        onReady: (event: any) => {
          setPlayerReady(true);
          const player = event.target;

          // Expose a clean PlayerRef interface
          const ref: PlayerRef = {
            playVideo:       () => player.playVideo(),
            pauseVideo:      () => player.pauseVideo(),
            seekTo:          (s, a = true) => player.seekTo(s, a),
            getCurrentTime:  () => player.getCurrentTime(),
            getPlayerState:  () => player.getPlayerState(),
            setPlaybackRate: (r) => player.setPlaybackRate(r),
          };
          onReady?.(ref);
        },

        onStateChange: (event: any) => {
          // Skip: event was triggered by our own sync action
          if (isSyncingRef.current) return;

          const state = event.data;
          const currentTime = playerRef.current?.getCurrentTime?.() ?? 0;
          onStateChange?.(state, currentTime);
        },

        onError: (event: any) => {
          const codes: Record<number, string> = {
            2:   "Invalid video ID",
            5:   "HTML5 player error",
            100: "Video not found or private",
            101: "Embedding not allowed",
            150: "Embedding not allowed",
          };
          setError(codes[event.data] ?? `Player error ${event.data}`);
          onError?.(event.data);
        },
      },
    });

    return () => {
      playerRef.current?.destroy?.();
      playerRef.current = null;
      setPlayerReady(false);
    };
  }, [apiReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update video when videoId prop changes ──────────────────
  useEffect(() => {
    if (!playerReady || !playerRef.current) return;
    isSyncingRef.current = true;
    playerRef.current.loadVideoById(videoId);
    setTimeout(() => { isSyncingRef.current = false; }, 600);
  }, [videoId, playerReady]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "#000", borderRadius: "12px", overflow: "hidden" }}>
      {/* Loading shimmer */}
      {!playerReady && !error && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "var(--bg-surface)",
        }}>
          <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
            <div className="spinner" style={{
              width: 28, height: 28, margin: "0 auto 0.75rem",
              borderColor: "rgba(255,255,255,0.1)",
              borderTopColor: "var(--amber-400)",
            }} />
            <p style={{ fontSize: "0.82rem" }}>Loading player…</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "var(--bg-surface)",
          flexDirection: "column", gap: "0.5rem",
          color: "var(--red-500)", fontSize: "0.88rem",
        }}>
          <span style={{ fontSize: "1.5rem" }}>⚠</span>
          {error}
        </div>
      )}

      {/* Player container — YT API mounts iframe here */}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
