import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js configuration. Contains NO Node-only dependencies
 * (no Prisma, no bcrypt) so it can be imported by the middleware, which runs
 * on the edge runtime. The real Credentials provider is attached in `auth.ts`.
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.status = user.status;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as typeof session.user.role;
        session.user.status = token.status as typeof session.user.status;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
