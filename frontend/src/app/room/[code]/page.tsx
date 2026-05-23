import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import RoomPage from "@/components/RoomPage";

interface Props {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `Room ${code.toUpperCase()} — TubeSync`,
    description: `Watch party room ${code.toUpperCase()}. Join the sync!`,
  };
}

export default async function RoomRoute({ params }: Props) {
  const { code } = await params;
  const roomCode = code.toUpperCase();

  // Must be authenticated
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

  let roomId: string | null = null;
  let roomExists = false;

  try {
    const res = await fetch(`${apiUrl}/rooms/code/${roomCode}`, {
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      roomId = data.roomId ?? null;
      // Room exists in DB — may or may not be active in memory
      roomExists = roomId !== null;
    }
    // 404 → roomExists stays false → RoomPage shows "room not found" screen
  } catch {
    // Backend unreachable — still render, let the WS handle the error gracefully
    roomExists = true; // optimistic: attempt connection, it will fail with proper UX
  }

  return (
    <RoomPage
      roomCode={roomCode}
      roomId={roomId}
      roomExists={roomExists}
    />
  );
}
