/**
 * Client-side utility to get the raw NextAuth JWT token.
 * Used when establishing the WebSocket connection (passed as ?token= query param)
 * and for REST API calls that require authentication.
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/token");
    if (!res.ok) return null;
    const data = await res.json();
    return data.token ?? null;
  } catch {
    return null;
  }
}
