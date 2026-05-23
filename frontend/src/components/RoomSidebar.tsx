"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";

interface ParticipantDto {
  userId: string;
  displayName: string;
  role: "HOST" | "MOD" | "PARTICIPANT" | "VIEWER";
}

export interface ChatMessageDto {
  id: string;
  userId: string;
  displayName: string;
  content: string;
  sentAt: string;
}

interface SidebarProps {
  roomCode: string;
  participants: ParticipantDto[];
  myUserId: string;
  myRole: ParticipantDto["role"];
  chatMessages: ChatMessageDto[];
  onPromote: (userId: string) => void;
  onDemote: (userId: string) => void;
  onKick: (userId: string) => void;
  onMakeViewer: (userId: string) => void;
  onRestoreParticipant: (userId: string) => void;
  onSendChat: (content: string) => void;
}

function dicebearUrl(seed: string) {
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(seed)}&radius=50&backgroundColor=0f0f1a,141424,1a1a2e&shapeColor=fbbf24,a78bfa,22c55e,f472b6`;
}

const ROLE_ORDER: Record<ParticipantDto["role"], number> = {
  HOST: 0,
  MOD: 1,
  PARTICIPANT: 2,
  VIEWER: 3,
};

const ROLE_LABELS: Record<ParticipantDto["role"], string> = {
  HOST: "Host",
  MOD: "Mod",
  PARTICIPANT: "Participant",
  VIEWER: "Viewer",
};

const REACTIONS = ["👏", "😂", "❤️", "🔥", "😮", "💯"];

interface FloatingReaction {
  id: number;
  emoji: string;
  x: number;
}

export function RoomSidebar({
  roomCode,
  participants,
  myUserId,
  myRole,
  chatMessages,
  onPromote,
  onDemote,
  onKick,
  onMakeViewer,
  onRestoreParticipant,
  onSendChat,
}: SidebarProps) {
  const [chatInput, setChatInput] = useState("");
  const [copied, setCopied] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const isHost = myRole === "HOST";
  const isMod = myRole === "MOD";
  const isPrivileged = isHost || isMod;

  const sorted = [...participants].sort(
    (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]
  );

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  function copyCode() {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 600);
  }

  return (
    <aside className="room-zone-2">
      {/* ── Top Section: Room Info ── */}
      <div className="sidebar-section room-info-header">
        <div className="room-name">Watch Party</div>
        <div className="room-code-display">
          <span>{roomCode}</span>
          <button className={`copy-btn ${copied ? "copied" : ""}`} onClick={copyCode} title="Copy code">
            <i className={copied ? "ti ti-check" : "ti ti-copy"}></i>
          </button>
        </div>
      </div>

      <div className="sidebar-divider" />

      {/* ── Middle Section: Participants ── */}
      <div className="sidebar-section participants-section">
        {sorted.length === 0 && <p className="section-label" style={{ textAlign: "center" }}>Connecting...</p>}
        {sorted.map((p) => {
          const isMe = p.userId === myUserId;
          return (
            <div key={p.userId} className="participant-row group">
              <div className={`participant-avatar role-${p.role}`}>🐱</div>
              <div className="participant-name-wrap" style={{ flex: 1 }}>
                {p.role === "HOST" && <i className="ti ti-crown" style={{ color: "#FAC775", fontSize: "14px" }}></i>}
                <span className="participant-name">
                  {p.displayName} {isMe && <span style={{ opacity: 0.5 }}>(you)</span>}
                </span>
                <span className={`role-badge ${p.role.toLowerCase()}`}>{ROLE_LABELS[p.role]}</span>
              </div>
              
              {/* Actions Menu */}
              {isHost && !isMe && (
                <div style={{ display: "flex", gap: "0.25rem", opacity: 0, transition: "opacity 0.15s ease" }} className="hover-menu">
                  {p.role === "PARTICIPANT" && (
                    <button className="btn-ghost-circle" style={{ width: "24px", height: "24px", fontSize: "12px" }} onClick={() => onPromote(p.userId)} title="Promote to Mod">
                      <i className="ti ti-arrow-up"></i>
                    </button>
                  )}
                  {p.role === "MOD" && (
                    <button className="btn-ghost-circle" style={{ width: "24px", height: "24px", fontSize: "12px" }} onClick={() => onDemote(p.userId)} title="Demote to Participant">
                      <i className="ti ti-arrow-down"></i>
                    </button>
                  )}
                  {p.role !== "VIEWER" && (
                    <button className="btn-ghost-circle" style={{ width: "24px", height: "24px", fontSize: "12px" }} onClick={() => onMakeViewer(p.userId)} title="Make Viewer">
                      <i className="ti ti-eye-off"></i>
                    </button>
                  )}
                  {p.role === "VIEWER" && (
                    <button className="btn-ghost-circle" style={{ width: "24px", height: "24px", fontSize: "12px" }} onClick={() => onRestoreParticipant(p.userId)} title="Restore Participant">
                      <i className="ti ti-eye"></i>
                    </button>
                  )}
                  <button className="btn-ghost-circle" style={{ width: "24px", height: "24px", fontSize: "12px", color: "red" }} onClick={() => onKick(p.userId)} title="Kick">
                    <i className="ti ti-x"></i>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="sidebar-divider" />

      {/* ── Bottom Section: Chat ── */}
      <div className="sidebar-section chat-section">
        {chatMessages.length === 0 && (
          <p className="section-label" style={{ margin: "auto" }}>No messages yet</p>
        )}
        {chatMessages.map((msg) => {
          const author = participants.find(p => p.userId === msg.userId);
          const authorRole = author ? author.role : "PARTICIPANT";
          const isViewerMsg = authorRole === "VIEWER";
          return (
            <div key={msg.id} className={`chat-message ${isViewerMsg ? 'viewer-msg' : ''}`}>
              {isViewerMsg && <i className="ti ti-eye" style={{ fontSize: "12px", marginRight: "4px" }}></i>}
              <span className={`chat-author role-${authorRole}`}>
                {msg.displayName}
              </span>
              {!isViewerMsg && <span style={{ opacity: 0.5, marginRight: "4px" }}>:</span>}
              <span>{msg.content}</span>
            </div>
          );
        })}
        <div ref={chatBottomRef} />
      </div>

      <div className="chat-input-area">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (chatInput.trim() && myRole !== "VIEWER") {
              onSendChat(chatInput);
              setChatInput("");
            }
          }}
          style={{ width: "100%" }}
        >
          <div className="chat-input-wrap">
            <input
              type="text"
              className="input"
              placeholder={myRole === "VIEWER" ? "Viewers cannot chat" : "Type a message..."}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={myRole === "VIEWER"}
            />
            <button type="submit" className="btn-send" disabled={myRole === "VIEWER" || !chatInput.trim()}>
              <i className="ti ti-send"></i>
            </button>
          </div>
        </form>
      </div>
    </aside>
  );
}

