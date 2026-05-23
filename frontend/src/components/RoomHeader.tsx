"use client";

import { useState } from "react";

interface RoomHeaderProps {
  roomCode: string;
  participantCount: number;
  isHost: boolean;
  onLeave: () => void;
}

export function RoomHeader({ roomCode, participantCount, isHost, onLeave }: RoomHeaderProps) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    await navigator.clipboard.writeText(roomCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <header className="room-header">
      {/* Left: brand + room code */}
      <div className="room-header-left">
        <span className="room-brand">TubeSync</span>
        <div className="room-code-pill" onClick={copyCode} title="Click to copy">
          <span className="room-code-label">ROOM</span>
          <span className="room-code-value">{roomCode}</span>
          <span className="room-code-copy">{copied ? "✓" : "⎘"}</span>
        </div>
      </div>

      {/* Right: participants + role badge + leave */}
      <div className="room-header-right">
        <div className="participant-count">
          <span className="participant-dot" />
          {participantCount} watching
        </div>
        {isHost && <span className="role-badge host">Host</span>}
        <button id="leave-room-btn" className="btn btn-ghost" style={{ padding: "0.45rem 0.9rem" }} onClick={onLeave}>
          Leave
        </button>
      </div>
    </header>
  );
}
