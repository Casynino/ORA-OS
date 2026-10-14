import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifyTotpStep } from "@/lib/developer/totp";
import { writeDevAudit } from "@/lib/developer/audit";

/**
 * The Developer sign-in gate. Called from the Credentials `authorize()` so it
 * protects EVERY path to a session (the login form AND the raw /api/auth
 * callback). All required:
 *   1. the account's password (bcrypt),
 *   2. a current authenticator code (TOTP) that has NOT been used before,
 *   3. not locked out.
 * If DEV_TOTP_SECRET isn't configured the gate FAILS CLOSED, and so does any
 * internal error. Every attempt is written to the audit trail under the
 * developer's own identity.
 *
 * Concurrency: the whole attempt runs inside ONE transaction holding a
 * per-account advisory lock, so "count failures → check credentials → record
 * the failure" can't be raced by firing many guesses in parallel — they queue
 * and each one sees the failures recorded by the ones before it.
 *
 * Lockout: 5 failures from the same IP, or 20 from anywhere, in 15 minutes.
 * (The per-IP cap means a stranger who knows your email can't easily keep YOU
 * locked out; the overall cap bounds a distributed guessing attempt.)
 */

export const DEV_LOCK_WINDOW_MIN = 15;
const MAX_FAILS_PER_IP = 5;
const MAX_FAILS_TOTAL = 20;

export async function authenticateDeveloper(
  user: { id: string; name: string; passwordHash: string },
  password: string,
  code: string | undefined,
  meta: { ip: string | null; userAgent: string | null },
): Promise<boolean> {
  const actor = { id: user.id, name: user.name };
  const secret = process.env.DEV_TOTP_SECRET;

  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"dev-login:" + user.id}))`;

        const log = (
          action: string,
          summary: string,
          outcome: "SUCCESS" | "FAILED",
          reason?: string,
          extra?: Record<string, number>,
        ) =>
          writeDevAudit(tx, {
            actor,
            action,
            entity: "Session",
            entityId: user.id,
            summary,
            outcome,
            reason: reason ?? null,
            extra,
            ...meta,
          });
        const fail = async (reason: string) => {
          await log("DEV_LOGIN_FAILED", `Failed Developer sign-in (${reason}).`, "FAILED", reason);
          return false;
        };

        if (!secret) return fail("two-factor secret not configured");

        // ── Lockout (any error here propagates → fail closed) ──────────────
        const since = new Date(Date.now() - DEV_LOCK_WINDOW_MIN * 60_000);
        const failed = { actorId: user.id, action: "DEV_LOGIN_FAILED", createdAt: { gte: since } };
        const total = await tx.activityLog.count({ where: failed });
        const fromIp = meta.ip
          ? await tx.activityLog.count({ where: { ...failed, meta: { path: ["ip"], equals: meta.ip } } })
          : total;
        if (fromIp >= MAX_FAILS_PER_IP || total >= MAX_FAILS_TOTAL) {
          // One audit row per window — a flood of attempts can't flood the log.
          const already = await tx.activityLog.count({
            where: { actorId: user.id, action: "DEV_LOGIN_BLOCKED", createdAt: { gte: since } },
          });
          if (!already) {
            await log(
              "DEV_LOGIN_BLOCKED",
              "Developer sign-in blocked — too many recent failed attempts.",
              "FAILED",
              "locked out",
            );
          }
          return false;
        }

        // ── Both factors, evaluated together; same message for either ──────
        const passwordOk = await bcrypt.compare(password, user.passwordHash);
        const step = verifyTotpStep(secret, code ?? "");
        if (!passwordOk || step === null) return fail("wrong password or code");

        // ── One-time use: a code (30s step) can't be replayed ──────────────
        const last = await tx.activityLog.findFirst({
          where: { actorId: user.id, action: "DEV_LOGIN" },
          orderBy: { createdAt: "desc" },
          select: { meta: true },
        });
        const lastStep = (last?.meta as { totpStep?: number } | null)?.totpStep;
        if (typeof lastStep === "number" && step <= lastStep) return fail("code already used");

        await log("DEV_LOGIN", "Developer signed in.", "SUCCESS", undefined, { totpStep: step });
        return true;
      },
      { maxWait: 10_000, timeout: 20_000 },
    );
  } catch (e) {
    console.error("[developerLogin]", e instanceof Error ? e.message : e);
    return false; // fail closed
  }
}
