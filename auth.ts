import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/db";
import { authenticateDeveloper } from "@/lib/developer/login";
import { canWorkAs, WORK_AS_MAX_MS, type ActAs } from "@/lib/developer/acting";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// A Developer session is deliberately short-lived (8h), independent of the
// longer staff session lifetime.
const DEV_SESSION_MS = 8 * 60 * 60 * 1000;

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
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

        // ── One login page, two sets of checks ─────────────────────────────
        // The server — not anything the browser sends — decides from the ACCOUNT
        // which checks apply: the Developer gets the hardened path (lockout +
        // full audit trail), everyone else the normal password check. There is
        // no switch to flip, so the raw /api/auth endpoint can't skip either.
        if (user.role === "DEVELOPER") {
          const ok = await authenticateDeveloper(user, password, { ip, userAgent });
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
    async jwt({ token, user, trigger, session }) {
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

        // ── "Work as" (Developer only) ─────────────────────────────────────
        // Only a REAL developer token may carry actAs: anyone else's token has it
        // stripped, so a forged client-side update() does nothing. The target is
        // re-validated on EVERY read, so it ends the instant that person is
        // suspended or no longer an eligible staff role.
        if (db.role === "DEVELOPER") {
          const pick = { id: true, name: true, email: true, role: true, status: true } as const;
          if (trigger === "update" && session && typeof session === "object" && "actAs" in session) {
            const want = (session as { actAs?: string | null }).actAs;
            if (!want) {
              delete token.actAs;
            } else {
              const t = await prisma.user.findUnique({ where: { id: want }, select: pick });
              // A switch is honoured only with the developer's LATEST start/stop
              // audit row being a fresh DEV_ACT_START for exactly this target — no
              // record, no working-as; and once Stop is pressed (a newer STOP row)
              // an old start row can't be replayed to resume.
              const auditId = (session as { actAuditId?: string }).actAuditId;
              const latest = auditId
                ? await prisma.activityLog.findFirst({
                    where: { actorId: token.id as string, action: { in: ["DEV_ACT_START", "DEV_ACT_STOP"] } },
                    orderBy: { createdAt: "desc" },
                    select: { id: true, action: true, entityId: true, createdAt: true },
                  })
                : null;
              const proven =
                !!latest &&
                latest.id === auditId &&
                latest.action === "DEV_ACT_START" &&
                latest.entityId === want &&
                Date.now() - latest.createdAt.getTime() < 60_000;
              if (t && proven && canWorkAs(t, token.id as string))
                token.actAs = { id: t.id, role: t.role, name: t.name, email: t.email, at: Date.now() };
              else delete token.actAs;
            }
          } else if (token.actAs) {
            const current = token.actAs as ActAs;
            // Working-as ends by itself after WORK_AS_MAX_MS (old tokens with no
            // start time count as expired).
            const expired = !current.at || Date.now() - current.at > WORK_AS_MAX_MS;
            const t = expired ? null : await prisma.user.findUnique({ where: { id: current.id }, select: pick });
            if (t && canWorkAs(t, token.id as string))
              token.actAs = { id: t.id, role: t.role, name: t.name, email: t.email, at: current.at };
            else delete token.actAs;
          }
        } else {
          delete token.actAs;
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
        const act = token.actAs as ActAs | undefined;
        // While working as a staff member the session IS that person (so every
        // existing screen and permission check just works)…
        session.user.id = act ? act.id : (token.id as string);
        session.user.role = (act ? act.role : token.role) as typeof session.user.role;
        session.user.status = token.status as typeof session.user.status;
        session.user.name = act ? act.name : ((token.name as string) ?? session.user.name);
        session.user.email = act ? act.email : ((token.email as string) ?? session.user.email);
        session.user.preferredName = act ? null : ((token.preferredName as string | null) ?? null);
        session.user.avatar = act ? null : ((token.avatar as string | null) ?? null);
        // …and this marks who is REALLY behind it, so everything done is recorded
        // under the Developer.
        session.user.impersonatedBy = act
          ? { id: token.id as string, name: (token.name as string) ?? "Developer" }
          : null;
      }
      return session;
    },
  },
});
