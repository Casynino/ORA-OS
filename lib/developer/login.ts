import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifyTotp } from "@/lib/developer/totp";
import { writeDevAuditSafe } from "@/lib/developer/audit";

/**
 * The Developer sign-in gate. Called from the Credentials `authorize()` so it
 * protects EVERY path to a session (the login form AND the raw /api/auth
 * callback). Three factors, all required:
 *   1. the account's password (bcrypt),
 *   2. a current authenticator code (TOTP, secret only in DEV_TOTP_SECRET),
 *   3. not currently locked out (5 failures / 15 min → blocked, audited).
 * If DEV_TOTP_SECRET isn't configured the gate FAILS CLOSED — no secret, no
 * Developer login. Every attempt (success or failure) is written to the audit
 * trail under the developer's own identity.
 */

export const DEV_LOCK_WINDOW_MIN = 15;
export const DEV_LOCK_MAX_FAILS = 5;

/** Recent failed developer sign-ins for this account (drives the lockout). */
export async function recentDevLoginFailures(userId: string): Promise<number> {
  try {
    return await prisma.activityLog.count({
      where: {
        actorId: userId,
        action: "DEV_LOGIN_FAILED",
        createdAt: { gte: new Date(Date.now() - DEV_LOCK_WINDOW_MIN * 60_000) },
      },
    });
  } catch {
    return 0;
  }
}

export async function isDeveloperLocked(userId: string): Promise<boolean> {
  return (await recentDevLoginFailures(userId)) >= DEV_LOCK_MAX_FAILS;
}

export async function authenticateDeveloper(
  user: { id: string; name: string; passwordHash: string },
  password: string,
  code: string | undefined,
  meta: { ip: string | null; userAgent: string | null },
): Promise<boolean> {
  const actor = { id: user.id, name: user.name };
  const fail = async (reason: string) => {
    await writeDevAuditSafe({
      actor,
      action: "DEV_LOGIN_FAILED",
      entity: "Session",
      entityId: user.id,
      summary: `Failed Developer sign-in (${reason}).`,
      outcome: "FAILED",
      reason,
      ...meta,
    });
    return false;
  };

  const secret = process.env.DEV_TOTP_SECRET;
  if (!secret) return fail("two-factor secret not configured");

  if (await isDeveloperLocked(user.id)) {
    // Not counted as another failure — the window simply has to expire.
    await writeDevAuditSafe({
      actor,
      action: "DEV_LOGIN_BLOCKED",
      entity: "Session",
      entityId: user.id,
      summary: "Developer sign-in blocked — too many recent failed attempts.",
      outcome: "FAILED",
      reason: "locked out",
      ...meta,
    });
    return false;
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  const codeOk = verifyTotp(secret, code ?? "");
  // Same message for either factor failing — don't reveal which one was wrong.
  if (!passwordOk || !codeOk) return fail("wrong password or code");

  await writeDevAuditSafe({
    actor,
    action: "DEV_LOGIN",
    entity: "Session",
    entityId: user.id,
    summary: "Developer signed in.",
    outcome: "SUCCESS",
    ...meta,
  });
  return true;
}
