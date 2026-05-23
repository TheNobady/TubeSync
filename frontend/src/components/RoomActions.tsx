"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export function RoomActions() {
  const { data: session } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<"create" | "join">("create");
  const [joinCode, setJoinCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && session?.user) {
      const saved = localStorage.getItem("tubeSyncDisplayName");
      if (saved) {
        setDisplayName(saved);
      } else {
        if (session.user.name) {
          setDisplayName(session.user.name.split(" ")[0]);
        }
        setShowModal(true);
      }
    }
  }, [session]);

  if (!session) return null;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;

  async function handleCreate() {
    setError("");
    setLoading(true);
    const finalName = displayName.trim() || session!.user!.name || "Anonymous";
    localStorage.setItem("tubeSyncDisplayName", finalName);

    try {
      const tokenRes = await fetch("/api/auth/token");
      const { token } = await tokenRes.json();

      const res = await fetch(`${apiUrl}/rooms/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ displayName: finalName }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? `Error ${res.status}`);
      }

      const { roomCode } = await res.json();
      router.push(`/room/${roomCode}`);
    } catch (e: any) {
      setError(e.message ?? "Failed to create room");
      setLoading(false);
    }
  }

  async function handleJoin() {
    setError("");
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setError("Room code must be 6 characters");
      return;
    }
    setLoading(true);
    const finalName = displayName.trim() || session!.user!.name || "Anonymous";
    localStorage.setItem("tubeSyncDisplayName", finalName);

    try {
      const tokenRes = await fetch("/api/auth/token");
      const { token } = await tokenRes.json();

      const res = await fetch(`${apiUrl}/rooms/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code,
          displayName: finalName,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? `Room not found or closed`);
      }

      const { roomCode } = await res.json();
      router.push(`/room/${roomCode}`);
    } catch (e: any) {
      setError(e.message ?? "Failed to join room");
      setLoading(false);
    }
  }

  return (
    <>
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">Choose your display name for this session</h3>
            <input
              className="input text-center"
              type="text"
              placeholder="Display Name"
              value={displayName}
              maxLength={32}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setShowModal(false)}
              autoFocus
            />
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => setShowModal(false)}>
              Confirm
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="error-text" style={{ textAlign: "center", marginBottom: "1rem" }}>
          {error}
        </p>
      )}

      <div className="action-cards-container animate-in">
        <div className="action-card create-card card">
          <i className="ti ti-video-plus action-card-icon" />
          <h3 className="action-card-title">Create a Room</h3>
          <p className="action-card-desc">Start a new watch party and invite friends.</p>
          <button
            className="btn btn-primary"
            disabled={loading}
            onClick={handleCreate}
            style={{ marginTop: "auto", borderRadius: "8px" }}
          >
            {loading && tab === "create" ? "Creating..." : "Create Room"}
          </button>
        </div>

        <div className="action-card join-card card">
          <i className="ti ti-door-enter action-card-icon" />
          <h3 className="action-card-title">Join a Room</h3>
          <p className="action-card-desc">Enter a 6-letter code to join an existing party.</p>
          <input
            className="input mono"
            style={{ textAlign: "center", letterSpacing: "0.2em", fontSize: "1.25rem", textTransform: "uppercase" }}
            type="text"
            placeholder="ABC123"
            value={joinCode}
            maxLength={6}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setTab("join");
                handleJoin();
              }
            }}
          />
          <button
            className="btn btn-outline"
            disabled={loading || joinCode.length !== 6}
            onClick={() => {
              setTab("join");
              handleJoin();
            }}
            style={{ marginTop: "auto", borderRadius: "8px" }}
          >
            {loading && tab === "join" ? "Joining..." : "Join Room"}
          </button>
        </div>
      </div>
    </>
  );
}
