import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export { authOptions };

/**
 * Server-side helper to get the current session.
 * Use in Server Components and Route Handlers.
 */
export async function getSession() {
  return getServerSession(authOptions);
}
