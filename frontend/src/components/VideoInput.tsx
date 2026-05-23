"use client";

import { useState } from "react";

interface VideoInputProps {
  onSubmit: (videoId: string) => void;
  isHost: boolean;
}

function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  // Plain video ID (11 chars)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  // Various YouTube URL formats
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtube.com")) {
      return url.searchParams.get("v");
    }
    if (url.hostname === "youtu.be") {
      return url.pathname.slice(1).split("?")[0] || null;
    }
  } catch {}
  return null;
}

export function VideoInput({ onSubmit, isHost }: VideoInputProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  if (!isHost) return null;

  function handleSubmit() {
    setError("");
    const videoId = extractVideoId(value);
    if (!videoId) {
      setError("Paste a valid YouTube URL or video ID");
      return;
    }
    onSubmit(videoId);
    setValue("");
  }

  return (
    <div className="video-input-bar">
      <input
        id="video-url-input"
        className="input"
        type="text"
        placeholder="Paste a YouTube URL or video ID…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        style={{ flex: 1, borderRadius: "8px", fontSize: "0.88rem" }}
      />
      <button
        id="load-video-btn"
        className="btn btn-primary"
        style={{ width: "auto", padding: "0.75rem 1.25rem", borderRadius: "8px", fontSize: "0.88rem" }}
        onClick={handleSubmit}
      >
        Load video
      </button>
      {error && <p className="error-text" style={{ position: "absolute", bottom: "-1.4rem", left: 0, fontSize: "0.75rem" }}>{error}</p>}
    </div>
  );
}
