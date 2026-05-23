import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

/**
 * Returns the raw HS256-signed JWT to the client.
 * Used by the frontend to authenticate WebSocket connections and REST calls.
 * Only accessible to authenticated users (token = null if not signed in).
 */
export async function GET(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET!,
    raw: true, // Return the raw signed JWT string
  });

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({ token });
}
