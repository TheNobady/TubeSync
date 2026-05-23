"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { RoomHeader } from "@/components/RoomHeader";
import { YouTubePlayer, PlayerRef, YT_PLAYER_STATE } from "@/components/YouTubePlayer";
import { VideoInput } from "@/components/VideoInput";
import { RoomSidebar, ChatMessageDto } from "@/components/RoomSidebar";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParticipantDto {
  userId: string;
  displayName: string;
  role: "HOST" | "MOD" | "PARTICIPANT" | "VIEWER";
}

interface VideoStateDto {
  videoId: string | null;
  timestamp: number;
  speed: number;
  isPlaying: boolean;
}

interface RoomStateDto {
  roomId: string;
  videoState: VideoStateDto;
  participants: ParticipantDto[];
  event: "STATE_UPDATE" | "USER_JOINED" | "USER_LEFT" | "ROLE_CHANGED" | "ROOM_CLOSED" | "KICKED";
  kickedUserId: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_VIDEO = "dQw4w9WgXcQ";
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 3000;

// ── Connection status type ────────────────────────────────────────────────────

type ConnStatus =
  | "connecting"      // first connect attempt
  | "connected"       // WS is live
  | "reconnecting"    // lost, auto-retrying
  | "failed"          // gave up after MAX_RECONNECT_ATTEMPTS
  | "room_not_found"  // backend returned 404 for this room
  | "closed"          // ROOM_CLOSED event received
  | "kicked";         // KICKED event received

// ── Component ─────────────────────────────────────────────────────────────────

export default function RoomPage({
  roomCode,
  roomId,
  roomExists,
}: {
  roomCode: string;
  roomId: string | null;
  roomExists: boolean;
}) {
  const { data: session } = useSession();
  const router = useRouter();

  const [videoId, setVideoId] = useState<string>(DEFAULT_VIDEO);
  const [participants, setParticipants] = useState<ParticipantDto[]>([]);
  const [myRole, setMyRole] = useState<ParticipantDto["role"]>("PARTICIPANT");
  const [chatMessages, setChatMessages] = useState<ChatMessageDto[]>([]);
  const [connStatus, setConnStatus] = useState<ConnStatus>(
    roomExists ? "connecting" : "room_not_found"
  );
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [kickCountdown, setKickCountdown] = useState(5);

  const playerRef = useRef<PlayerRef | null>(null);
  const isSyncingRef = useRef(false);
  const stompClientRef = useRef<any>(null);
  const reconnectCountRef = useRef(0);
  const kickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);       // guard: stop async work after unmount
  const videoIdRef = useRef<string>(DEFAULT_VIDEO);  // always-current video id

  const isHost = myRole === "HOST";
  const isPrivileged = myRole === "HOST" || myRole === "MOD";

  // Keep videoIdRef in sync with state so closures always see the latest value
  useEffect(() => { videoIdRef.current = videoId; }, [videoId]);

  // ── STOMP / WebSocket connection ──────────────────────────────────────────

  const connect = useCallback(async () => {
    if (!session || !roomId || !roomExists) return;

    try {
      const tokenRes = await fetch("/api/auth/token");
      if (!tokenRes.ok) throw new Error("Token fetch failed");
      const { token } = await tokenRes.json();

      // Dynamic imports — avoids SSR issues and keeps bundle lean
      const [{ Client }, SockJS] = await Promise.all([
        import("@stomp/stompjs"),
        import("sockjs-client").then((m) => m.default ?? m),
      ]);

      if (unmountedRef.current) return; // Prevent connecting if component unmounted while awaiting

      const client = new Client({
        // SockJS factory — required when backend uses withSockJS()
        webSocketFactory: () =>
          new (SockJS as any)(`http://localhost:8080/ws?token=${encodeURIComponent(token)}`),

        reconnectDelay: 0, // we handle reconnect ourselves for better UX
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,

        onConnect: () => {
          reconnectCountRef.current = 0;
          setReconnectAttempt(0);
          setConnStatus("connected");
          stompClientRef.current = client;

          // Load chat history (needs auth header)
          const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";
          fetch(`${apiUrl}/rooms/${roomId}/chat/history`, {
            headers: { Authorization: `Bearer ${token}` }
          })
            .then(res => res.json())
            .then(data => setChatMessages(data))
            .catch(err => console.error("Failed to load chat history:", err));

          // Load initial room state (needs auth header)
          fetch(`${apiUrl}/rooms/${roomId}/state`, {
            headers: { Authorization: `Bearer ${token}` }
          })
            .then(res => {
               if (res.ok) return res.json();
               throw new Error("Failed to load room state");
            })
            .then((data: RoomStateDto) => handleServerState(data))
            .catch(err => console.error(err));

          // ── Room-wide state topic
          client.subscribe(`/topic/room/${roomId}`, (msg: any) => {
            if (!msg.body) return;
            try {
              const state: RoomStateDto = JSON.parse(msg.body);
              handleServerState(state);
            } catch (e) {
              console.error("Failed to parse room state:", e);
            }
          });

          // ── Chat topic
          client.subscribe(`/topic/room/${roomId}/chat`, (msg: any) => {
            if (!msg.body) return;
            try {
              const chatDto: ChatMessageDto = JSON.parse(msg.body);
              setChatMessages(prev => {
                // Deduplicate by ID just in case
                if (prev.some(m => m.id === chatDto.id)) return prev;
                return [...prev, chatDto];
              });
            } catch (e) {
              console.error("Failed to parse chat message:", e);
            }
          });

          // ── Personal topic (KICKED events)
          const myId = (session?.user as any)?.id;
          if (myId) {
            client.subscribe(`/topic/room/${roomId}/user/${myId}`, (msg: any) => {
              if (!msg.body) return;
              try {
                const state: RoomStateDto = JSON.parse(msg.body);
                if (state.event === "KICKED") {
                  setConnStatus("kicked");
                  client.deactivate();
                  // Countdown redirect
                  let count = 5;
                  setKickCountdown(count);
                  kickIntervalRef.current = setInterval(() => {
                    count--;
                    setKickCountdown(count);
                    if (count <= 0) {
                      clearInterval(kickIntervalRef.current!);
                      router.push("/");
                    }
                  }, 1000);
                }
              } catch (e) {}
            });
          }
        },

        onDisconnect: () => {
          setConnStatus((prev) => {
            // Don't overwrite terminal states
            if (["kicked", "closed", "room_not_found", "failed"].includes(prev)) return prev;
            return "reconnecting";
          });
          stompClientRef.current = null;
          scheduleReconnect();
        },

        onStompError: (frame: any) => {
          console.error("STOMP error:", frame);
        },
      });

      stompClientRef.current = client;
      client.activate();
    } catch (err) {
      console.error("Connection error:", err);
      scheduleReconnect();
    }
  }, [session, roomId, roomExists]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bug #5 fix: stable useCallback so onDisconnect closure captures the right reference
  const scheduleReconnect = useCallback(() => {
    if (unmountedRef.current) return;  // Bug #9 fix: don't reconnect after unmount

    const attempt = reconnectCountRef.current + 1;
    reconnectCountRef.current = attempt;
    setReconnectAttempt(attempt);

    if (attempt > MAX_RECONNECT_ATTEMPTS) {
      setConnStatus("failed");
      return;
    }

    setConnStatus("reconnecting");
    reconnectTimerRef.current = setTimeout(() => {
      if (!unmountedRef.current) connect();
    }, RECONNECT_DELAY_MS);
  }, [connect]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial connection
  useEffect(() => {
    if (!session || !roomExists || !roomId) return;
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;  // Bug #9: prevent reconnect after unmount
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      stompClientRef.current?.deactivate();
      stompClientRef.current = null;
      if (kickIntervalRef.current) clearInterval(kickIntervalRef.current);
    };
  }, [session, roomId, roomExists]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Apply server state ────────────────────────────────────────────────────

  const handleServerState = useCallback((state: RoomStateDto) => {
    if (state.event === "ROOM_CLOSED") {
      setConnStatus("closed");
      return;
    }

    setParticipants(state.participants);
    const myId = (session?.user as any)?.id;
    const me = state.participants.find((p) => p.userId === myId);
    if (me) setMyRole(me.role);

    const vs = state.videoState;
    if (!vs || !playerRef.current) return;

    isSyncingRef.current = true;

    // Bug #4+6 fix: use ref (not stale closure state) to compare video IDs
    if (vs.videoId && vs.videoId !== videoIdRef.current) {
      videoIdRef.current = vs.videoId;
      setVideoId(vs.videoId);
    }

    const player = playerRef.current;
    const serverTime = vs.timestamp ?? 0;
    const localTime = player.getCurrentTime();
    let didSync = false;

    if (Math.abs(localTime - serverTime) > 1.5) {
      player.seekTo(serverTime);
      didSync = true;
    }

    const currentState = player.getPlayerState();
    if (vs.isPlaying && currentState !== YT_PLAYER_STATE.PLAYING && currentState !== YT_PLAYER_STATE.BUFFERING) {
      player.playVideo();
      didSync = true;
    } else if (!vs.isPlaying && currentState !== YT_PLAYER_STATE.PAUSED && currentState !== YT_PLAYER_STATE.UNSTARTED) {
      player.pauseVideo();
      didSync = true;
    }

    if (didSync) {
      isSyncingRef.current = true;
      setTimeout(() => { isSyncingRef.current = false; }, 600);
    }
  }, [session]); // removed videoId dep — now uses videoIdRef

  // ── Send action ───────────────────────────────────────────────────────────

  const sendAction = useCallback((type: string, payload: Record<string, any> = {}) => {
    const client = stompClientRef.current;
    if (!client?.connected) return;
    client.publish({
      destination: `/app/room/${roomId}/action`,
      body: JSON.stringify({ type, ...payload }),
    });
  }, [roomId]);

  // ── Heartbeat (Phase 14) ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isHost || connStatus !== "connected") return;
    
    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      
      const state = player.getPlayerState();
      // Only send heartbeat if actively playing
      if (state === YT_PLAYER_STATE.PLAYING) {
        sendAction("PLAY", { timestamp: player.getCurrentTime() });
      }
    }, 4000); // 4 second heartbeat
    
    return () => clearInterval(interval);
  }, [isHost, connStatus, sendAction]);

  // ── Player event handlers ─────────────────────────────────────────────────

  const handlePlayerReady = useCallback((player: PlayerRef) => {
    playerRef.current = player;
  }, []);

  const handleStateChange = useCallback((state: number, currentTime: number) => {
    if (!isPrivileged) return;
    if (isSyncingRef.current) return;
    if (state === YT_PLAYER_STATE.PLAYING) {
      sendAction("PLAY", { timestamp: currentTime });
    } else if (state === YT_PLAYER_STATE.PAUSED) {
      sendAction("PAUSE", { timestamp: currentTime });
    }
  }, [isPrivileged, sendAction]);

  const handleVideoChange = useCallback((newVideoId: string) => {
    sendAction("CHANGE_VIDEO", { videoId: newVideoId, timestamp: 0 });
    setVideoId(newVideoId);
  }, [sendAction]);

  // ── Role management ───────────────────────────────────────────────────────

  const handlePromote = useCallback((targetUserId: string) => {
    sendAction("PROMOTE", { targetUserId });
  }, [sendAction]);

  const handleDemote = useCallback((targetUserId: string) => {
    sendAction("DEMOTE", { targetUserId });
  }, [sendAction]);

  const handleKick = useCallback((targetUserId: string) => {
    sendAction("KICK", { targetUserId });
  }, [sendAction]);

  const handleMakeViewer = useCallback((targetUserId: string) => {
    sendAction("MAKE_VIEWER", { targetUserId });
  }, [sendAction]);

  const handleRestoreParticipant = useCallback((targetUserId: string) => {
    sendAction("RESTORE_PARTICIPANT", { targetUserId });
  }, [sendAction]);

  // ── Send Chat ─────────────────────────────────────────────────────────────

  const handleSendChat = useCallback((content: string) => {
    const client = stompClientRef.current;
    if (!client?.connected) return;
    client.publish({
      destination: `/app/room/${roomId}/chat`,
      body: JSON.stringify({ content }),
    });
  }, [roomId]);

  // ── Leave room ────────────────────────────────────────────────────────────

  function handleLeave() {
    stompClientRef.current?.publish({
      destination: `/app/room/${roomId}/leave`,
      body: JSON.stringify({}),
    });
    stompClientRef.current?.deactivate();
    router.push("/");
  }

  // ── Manual reconnect (after "failed") ────────────────────────────────────

  function handleManualReconnect() {
    reconnectCountRef.current = 0;
    setReconnectAttempt(0);
    setConnStatus("connecting");
    connect();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Terminal state screens
  // ══════════════════════════════════════════════════════════════════════════

  // ── Room not found ────────────────────────────────────────────────────────
  if (connStatus === "room_not_found") {
    return (
      <div className="not-found-container">
        <svg viewBox="0 0 300 200" className="cat-svg" xmlns="http://www.w3.org/2000/svg" style={{ width: "300px", height: "200px" }}>
          {/* Room Background (Rectangle) */}
          <rect x="20" y="20" width="260" height="160" fill="transparent" stroke="var(--border-color)" strokeWidth="4" />
          {/* Door ajar */}
          <rect x="220" y="60" width="40" height="120" fill="var(--bg-card)" stroke="var(--border-color)" strokeWidth="2" transform="skewY(-15) translate(0, 30)" />
          {/* Confused Cat */}
          <g transform="translate(100, 100)">
            {/* Body */}
            <path d="M20,80 C20,30 80,30 80,80 L80,80 L20,80 Z" fill="var(--bg-card)" stroke="var(--accent-color)" strokeWidth="3" />
            {/* Head */}
            <circle cx="50" cy="40" r="30" fill="var(--bg-card)" stroke="var(--accent-color)" strokeWidth="3" />
            {/* Ears */}
            <polygon points="25,25 35,0 45,20" fill="var(--bg-card)" stroke="var(--accent-color)" strokeWidth="3" />
            <polygon points="55,20 65,0 75,25" fill="var(--bg-card)" stroke="var(--accent-color)" strokeWidth="3" />
            {/* Question Mark Eyes */}
            <text x="32" y="45" fontSize="18" fill="var(--text-primary)" fontFamily="sans-serif" fontWeight="bold">?</text>
            <text x="56" y="45" fontSize="18" fill="var(--text-primary)" fontFamily="sans-serif" fontWeight="bold">?</text>
            {/* Nose */}
            <polygon points="48,52 52,52 50,55" fill="var(--text-primary)" />
          </g>
        </svg>
        <div className="not-found-text" style={{ fontSize: "20px" }}>
          This room doesn't exist... or maybe it never did.
        </div>
        <button className="btn btn-primary" style={{ width: "200px" }} onClick={() => router.push("/")}>
          Go Home
        </button>
      </div>
    );
  }

  // ── Kicked ────────────────────────────────────────────────────────────────
  if (connStatus === "kicked") {
    return (
      <div className="page-wrapper">
        <div className="content" style={{ textAlign: "center", gap: "1.5rem" }}>
          <div style={{
            fontSize: "3.5rem",
            lineHeight: 1,
            filter: "drop-shadow(0 0 24px rgba(220,38,38,0.5))"
          }}>🚫</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", color: "#ef4444" }}>
            You were kicked
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.92rem" }}>
            The host removed you from this room.
          </p>
          <p style={{ color: "var(--text-subtle)", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums" }}>
            Redirecting in{" "}
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>{kickCountdown}s</span>…
          </p>
          <button className="btn btn-primary" style={{ width: "auto" }} onClick={() => router.push("/")}>
            Go home now
          </button>
        </div>
      </div>
    );
  }

  // ── Room closed ───────────────────────────────────────────────────────────
  if (connStatus === "closed") {
    return (
      <div className="page-wrapper">
        <div className="content" style={{ textAlign: "center", gap: "1.5rem" }}>
          <div style={{ fontSize: "3.5rem", lineHeight: 1 }}>🎬</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "2rem" }}>
            Session ended
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.92rem" }}>
            The host ended this watch party. Hope you had fun!
          </p>
          <button className="btn btn-primary" style={{ width: "auto" }} onClick={() => router.push("/")}>
            Back to home
          </button>
        </div>
      </div>
    );
  }

  // ── Connection failed ─────────────────────────────────────────────────────
  if (connStatus === "failed") {
    return (
      <div className="page-wrapper">
        <div className="content" style={{ textAlign: "center", gap: "1.5rem" }}>
          <div style={{ fontSize: "3.5rem", lineHeight: 1 }}>📡</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "2rem" }}>
            Connection failed
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.92rem", maxWidth: 380 }}>
            Could not reach the server after {MAX_RECONNECT_ATTEMPTS} attempts.
            Check your network or try again.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <button className="btn btn-primary" style={{ width: "auto" }} onClick={handleManualReconnect}>
              Try again
            </button>
            <button className="btn btn-secondary" style={{ width: "auto" }} onClick={() => router.push("/")}>
              Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Main room layout
  // ══════════════════════════════════════════════════════════════════════════

  const isConnecting = connStatus === "connecting";
  const isReconnecting = connStatus === "reconnecting";

  return (
    <div className="room-layout">
      {/* ── Zone 1: Video ── */}
      <main className="room-zone-1">

        {/* ── Connection status bar removed per 'minimal chrome' ──────────────────── */}

        {/* ── YouTube player ──────────────────────────── */}
        <div className="video-container">
          {isConnecting ? (
            <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
              <div className="skeleton-player" />
            </div>
          ) : (
            <>
              <YouTubePlayer
                videoId={videoId}
                onReady={handlePlayerReady}
                onStateChange={handleStateChange}
                isSyncingRef={isSyncingRef}
              />
            </>
          )}
        </div>

        {!isConnecting && (
          <div className="playback-controls" style={{ opacity: isPrivileged ? 1 : 0.3, pointerEvents: isPrivileged ? "auto" : "none" }}>
            {/* Seek bar removed per request */}
            <div className="controls-row" style={{ justifyContent: "center" }}>
               <button className="btn-ghost-circle" disabled={!isPrivileged}><i className="ti ti-player-skip-back" /></button>
               <button className="btn-ghost-circle play-btn" disabled={!isPrivileged}><i className="ti ti-player-play" /></button>
               <button className="btn-ghost-circle" disabled={!isPrivileged}><i className="ti ti-player-skip-forward" /></button>
               <div style={{ flex: 1, maxWidth: "20px" }}></div>
               <button className="btn-ghost-circle" disabled={!isPrivileged}><i className="ti ti-maximize" /></button>
            </div>
          </div>
        )}

        {/* Host video input */}
        {!isConnecting && isPrivileged && (
          <div className="video-input-row">
            <VideoInput onSubmit={handleVideoChange} isHost={isHost} />
          </div>
        )}
      </main>

      {/* ── Zone 2: Social Sidebar ── */}
      <RoomSidebar
        roomCode={roomCode}
        participants={participants}
        myUserId={(session?.user as any)?.id ?? ""}
        myRole={myRole}
        chatMessages={chatMessages}
        onPromote={handlePromote}
        onDemote={handleDemote}
        onKick={handleKick}
        onMakeViewer={handleMakeViewer}
        onRestoreParticipant={handleRestoreParticipant}
        onSendChat={handleSendChat}
      />
    </div>
  );
}
