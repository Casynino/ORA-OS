import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Developer audit trail. Every Developer action is written to the existing
 * append-only ActivityLog under the DEVELOPER's own identity — never under
 * another user. Rows carry the action prefix "DEV_" which the database itself
 * protects from UPDATE/DELETE (see scripts/developer-account.sql).
 *
 * Mutating actions call writeDevAudit() INSIDE the same transaction as the change
 * (no audit row ⇒ the change rolls back). writeDevAuditSafe() never throws and keeps
 * the trail to real CHANGES only (the owner's rule): signing in, looking at pages and
 * refused or failed attempts leave no track. The one exception is failed sign-ins,
 * which the password lockout counts.
 */

type Db = Prisma.TransactionClient | typeof prisma;

export type DevAuditInput = {
  actor: { id: string; name: string };
  /** Machine code — MUST start with "DEV_". */
  action: string;
  /** Module / record type affected, e.g. "User", "Records", "AuditLog". */
  entity: string;
  entityId?: string | null;
  summary: string;
  outcome: "SUCCESS" | "FAILED";
  reason?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  ip?: string | null;
  userAgent?: string | null;
  /** Extra machine-readable facts merged into meta (e.g. the TOTP step used). */
  extra?: Record<string, Prisma.InputJsonValue>;
};

export function devActorLabel(name: string) {
  return `${name} (Developer)`;
}

/** Writes the audit row and returns its id. Throws if it can't be written. */
export async function writeDevAudit(db: Db, input: DevAuditInput): Promise<string> {
  if (!input.action.startsWith("DEV_")) throw new Error("Developer audit actions must start with DEV_.");
  const row = await db.activityLog.create({
    select: { id: true },
    data: {
      actorId: input.actor.id,
      actorName: devActorLabel(input.actor.name),
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      summary: input.summary,
      meta: {
        developer: true,
        outcome: input.outcome,
        reason: input.reason ?? null,
        before: input.before ?? null,
        after: input.after ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        ...(input.extra ?? {}),
      },
    },
  });
  return row.id;
}

/** Failed sign-ins are kept because the lockout (5 wrong tries) counts them. */
const ALWAYS_KEEP = new Set(["DEV_LOGIN_FAILED", "DEV_LOGIN_BLOCKED"]);
/** Looking and signing in are not changes: no track. */
const NOT_A_CHANGE = new Set(["DEV_VIEW", "DEV_LOGIN"]);

/** Best-effort variant — never throws. Only successful changes (and failed sign-ins) leave a track. */
export async function writeDevAuditSafe(input: DevAuditInput): Promise<void> {
  if (!ALWAYS_KEEP.has(input.action) && (input.outcome !== "SUCCESS" || NOT_A_CHANGE.has(input.action))) return;
  try {
    await writeDevAudit(prisma, input);
  } catch (e) {
    console.error("[devAudit]", input.action, e instanceof Error ? e.message : e);
  }
}

/** Request metadata for the audit row (best-effort, first hop of x-forwarded-for). */
export function requestMeta(headers: Headers | null | undefined) {
  return {
    ip: headers?.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: headers?.get("user-agent")?.slice(0, 300) || null,
  };
}
