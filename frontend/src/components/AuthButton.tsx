"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";
import { useState } from "react";

export function AuthButton() {
  const { data: session, status } = useSession();
  const [signingIn, setSigningIn] = useState(false);

  if (status === "loading") {
    return (
      <button className="btn btn-google" disabled>
        <div className="spinner" style={{ borderColor: "rgba(255,255,255,0.2)", borderTopColor: "rgba(255,255,255,0.7)" }} />
        Loading…
      </button>
    );
  }

  if (session) return null; // authenticated — show user strip instead

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <button
        id="sign-in-btn"
        className="btn btn-google"
        disabled={signingIn}
        onClick={async () => {
          setSigningIn(true);
          await signIn("google");
        }}
      >
        {signingIn ? (
          <>
            <div className="spinner" style={{ borderColor: "rgba(255,255,255,0.2)", borderTopColor: "rgba(255,255,255,0.7)" }} />
            Redirecting…
          </>
        ) : (
          <>
            <GoogleIcon />
            Continue with Google
          </>
        )}
      </button>

      {process.env.NODE_ENV === "development" && (
        <button
          className="btn btn-secondary"
          disabled={signingIn}
          onClick={async () => {
            setSigningIn(true);
            await signIn("credentials", { username: "dev-user", callbackUrl: "/" });
          }}
          style={{ width: "100%" }}
        >
          Dev Login (Instant)
        </button>
      )}
    </div>
  );
}

export function UserStrip() {
  const { data: session, status } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  if (status !== "authenticated" || !session) return null;

  const name = session.user?.name ?? "User";
  const email = session.user?.email ?? "";
  const image = session.user?.image;
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2);

  return (
    <div className="user-strip animate-in">
      <div className="user-info">
        {image ? (
          <Image src={image} alt={name} width={34} height={34} className="avatar" />
        ) : (
          <div className="avatar-placeholder">{initials}</div>
        )}
        <div>
          <div className="user-name">{name}</div>
          <div className="user-email">{email}</div>
        </div>
      </div>
      <button
        className="btn btn-ghost"
        disabled={signingOut}
        onClick={async () => {
          setSigningOut(true);
          await signOut();
        }}
      >
        {signingOut ? "…" : "Sign out"}
      </button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
