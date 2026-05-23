import NextAuth, { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);

/**
 * Override NextAuth's default JWE encryption with standard HS256 signing.
 * This allows Spring Boot (JJWT) to verify the token using the same
 * NEXTAUTH_SECRET without needing to implement JWE decryption.
 */
export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "Development Login",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "dev-user" }
      },
      async authorize(credentials) {
        const username = credentials?.username || "dev-user";
        return {
          id: `dev-${username}`,
          name: username,
          email: `${username}@local.dev`,
          image: `https://api.dicebear.com/9.x/thumbs/svg?seed=${username}`,
        };
      }
    }),
  ],

  jwt: {
    // Produce a standard HS256 signed JWT instead of encrypted JWE
    encode: async ({ token }) => {
      return new SignJWT(token as Record<string, unknown>)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("30d")
        .sign(secret);
    },
    decode: async ({ token }) => {
      if (!token) return null;
      try {
        const { payload } = await jwtVerify(token, secret);
        return payload as Record<string, unknown>;
      } catch {
        return null;
      }
    },
  },

  callbacks: {
    async jwt({ token, account, profile, user }) {
      // For Credentials provider, user is available on the first sign-in
      if (user && account?.provider === "credentials") {
        token.sub = user.id;  // googleUid analog
        token.email = user.email;
        token.picture = user.image;
        token.name = user.name;

        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              googleUid: user.id,
              email: user.email,
              displayName: user.name,
              avatarUrl: user.image,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            token.dbUserId = data.userId; // real DB UUID
          }
        } catch (err) {
          console.error("Failed to sync dev user with backend:", err);
        }
      }

      // On first sign-in, embed Google identity into the token
      if (account?.provider === "google" && profile) {
        token.sub = profile.sub;
        token.email = profile.email;
        token.picture = (profile as any).picture;
        token.name = profile.name;

        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              googleUid: profile.sub,
              email: profile.email,
              displayName: profile.name,
              avatarUrl: (profile as any).picture,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            token.dbUserId = data.userId; // real DB UUID
          }
        } catch (err) {
          console.error("Failed to sync user with backend:", err);
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        // id = real DB UUID (used to match participant.userId in room state)
        (session.user as any).id = token.dbUserId ?? token.sub;
        // googleUid = the sub claim (Google UID or dev-* string)
        (session.user as any).googleUid = token.sub;
        // Restore name from token (not always populated by default)
        if (token.name) session.user.name = token.name as string;
      }
      return session;
    },
  },

  pages: {
    signIn: "/",        // Redirect unauthenticated users to landing page
    error: "/auth/error",
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
