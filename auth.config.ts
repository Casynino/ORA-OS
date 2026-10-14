import type { NextAuthConfig } from "next-auth";
import type { ActAs } from "@/lib/developer/acting";

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
        // While a Developer is working as a staff member, the middleware must
        // route by THAT person's role (so they land in the right dashboard).
        const act = token.actAs as ActAs | undefined;
        session.user.id = (act ? act.id : token.id) as string;
        session.user.role = (act ? act.role : token.role) as typeof session.user.role;
        session.user.status = token.status as typeof session.user.status;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
