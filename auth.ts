import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/db";
import { authenticateDeveloper } from "@/lib/developer/login";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  // Which login the user chose. Defaults to "staff" so every existing caller
  // (and the existing staff form) behaves exactly as before.
  mode: z.enum(["staff", "developer"]).default("staff"),
  code: z.string().optional(), // authenticator code — Developer login only
});

// A Developer session is deliberately short-lived (8h), independent of the
// longer staff session lifetime.
const DEV_SESSION_MS = 8 * 60 * 60 * 1000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        mode: { label: "Mode", type: "text" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials, request) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password, mode, code } = parsed.data;
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() },
        });
        if (!user) return null;

        // Only ACTIVE accounts may authenticate. PENDING agents await admin
        // approval; SUSPENDED accounts are blocked. The login server action
        // surfaces a friendly message for these states.
        if (user.status !== "ACTIVE") return null;

        const headers = request?.headers;
        const ip =
          headers?.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
        const userAgent = headers?.get("user-agent")?.slice(0, 300) || null;

        // ── Two separate doors ─────────────────────────────────────────────
        // The Developer account can ONLY come in through the Developer login
        // (password + authenticator code + lockout), and staff accounts can
        // ONLY come in through the staff login. Enforced here — not just in the
        // form — so the raw /api/auth endpoint can't be used to cross over.
        const isDeveloper = user.role === "DEVELOPER";
        if (isDeveloper !== (mode === "developer")) return null;

        if (isDeveloper) {
          const ok = await authenticateDeveloper(user, password, code, { ip, userAgent });
          if (!ok) return null;
        } else {
          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) return null;
        }

        // Record the sign-in — powers the profile's login history.
        try {
          await prisma.$transaction([
            prisma.loginEvent.create({
              data: { userId: user.id, ip, userAgent },
            }),
            prisma.user.update({
              where: { id: user.id },
              data: { lastLoginAt: new Date() },
            }),
          ]);
        } catch {
          /* login history must never block a sign-in */
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          preferredName: user.preferredName,
          avatar: user.avatar,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  // Node-side callbacks: refresh profile data from the DB on every session
  // read, so a renamed admin (or new avatar) shows up everywhere instantly,
  // and a bumped sessionVersion signs the account out on ALL devices.
  // (The middleware keeps using the edge-safe callbacks from auth.config.)
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.status = user.status;
        token.name = (user.name as string) ?? null;
        token.preferredName = user.preferredName ?? null;
        token.avatar = user.avatar ?? null;
        token.sv = user.sessionVersion ?? 0;
        if (user.role === "DEVELOPER") token.devAt = Date.now();
        return token;
      }
      if (!token.id) return token;
      try {
        const db = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            name: true,
            email: true,
            role: true,
            status: true,
            preferredName: true,
            avatar: true,
            sessionVersion: true,
          },
        });
        // Gone, suspended, or signed out everywhere → invalidate this session.
        if (!db || db.status !== "ACTIVE") return null;
        if (((token.sv as number | undefined) ?? 0) !== db.sessionVersion) return null;
        // Developer sessions expire after 8h; a developer token with no timestamp
        // is treated as expired (fail closed).
        if (db.role === "DEVELOPER") {
          const at = token.devAt as number | undefined;
          if (!at || Date.now() - at > DEV_SESSION_MS) return null;
        }
        token.name = db.name;
        token.email = db.email;
        token.role = db.role;
        token.status = db.status;
        token.preferredName = db.preferredName;
        token.avatar = db.avatar;
      } catch {
        /* transient DB failure — keep the existing token rather than logging out */
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as typeof session.user.role;
        session.user.status = token.status as typeof session.user.status;
        session.user.name = (token.name as string) ?? session.user.name;
        session.user.email = (token.email as string) ?? session.user.email;
        session.user.preferredName = (token.preferredName as string | null) ?? null;
        session.user.avatar = (token.avatar as string | null) ?? null;
      }
      return session;
    },
  },
});
