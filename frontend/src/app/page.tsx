import { Metadata } from "next";
import { AuthButton, UserStrip } from "@/components/AuthButton";
import { RoomActions } from "@/components/RoomActions";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "TubeSync — Watch Together",
  description:
    "Create a watch party room, share the 6-letter code, and enjoy YouTube videos in perfect sync with friends.",
};

export default async function HomePage() {
  const session = await getSession();
  const isAuthenticated = !!session;

  return (
    <main className="page-wrapper">
      <div className="landing-header">
        <h1 className="title" style={{ fontFamily: "Georgia, serif" }}>TUBESYNC</h1>
        <p className="landing-tagline">Watch together, anywhere.</p>
      </div>

      <div className="content" style={{ maxWidth: "800px", width: "100%" }}>
        {/* Auth section */}
        {!isAuthenticated ? (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "2rem" }}>
            <AuthButton />
          </div>
        ) : (
          <UserStrip />
        )}

        {/* Room Actions */}
        {isAuthenticated ? (
          <RoomActions />
        ) : (
          <div className="action-cards-container">
            <div className="action-card create-card card" style={{ opacity: 0.5, pointerEvents: "none" }}>
              <i className="ti ti-video-plus action-card-icon" />
              <h3 className="action-card-title">Create a Room</h3>
              <p className="action-card-desc">Sign in to start a new watch party.</p>
              <button className="btn btn-primary" disabled style={{ marginTop: "auto" }}>Create Room</button>
            </div>
            <div className="action-card join-card card" style={{ opacity: 0.5, pointerEvents: "none" }}>
              <i className="ti ti-door-enter action-card-icon" />
              <h3 className="action-card-title">Join a Room</h3>
              <p className="action-card-desc">Sign in to join an existing party.</p>
              <input className="input mono" placeholder="ABC123" disabled style={{ textAlign: "center", letterSpacing: "0.2em", textTransform: "uppercase" }} />
              <button className="btn btn-outline" disabled style={{ marginTop: "auto" }}>Join Room</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
