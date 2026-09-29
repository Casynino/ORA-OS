import "server-only";
import { prisma } from "@/lib/db";
import type { Role, NotificationCategory } from "@prisma/client";

/**
 * In-app notifications — the data layer behind the notification bell + sound.
 *
 * Every write here is FIRE-AND-FORGET (wrapped in try/catch): exactly like the
 * CEO WhatsApp helpers, notifying must NEVER break the workflow that triggered
 * it. Call these AFTER the primary transaction has committed.
 *
 * Targeting: a notification goes to EITHER one user (toUserId — "your sale was
 * approved") OR one-or-more roles (toRoles — "a sale needs verifying" to all
 * FINANCE). A recipient sees a row when its userId is theirs, or its role is
 * theirs and userId is null. Rehema/Daeda/Rajabu/Irene are one-per-role today,
 * so role broadcasts behave like personal inboxes.
 */

export type NotifyInput = {
  /** Deliver to this specific user. */
  toUserId?: string | null;
  /** Broadcast to everyone in each of these roles. */
  toRoles?: Role[];
  /** ACTION rings until resolved; INFO rings once. Defaults to INFO. */
  category?: NotificationCategory;
  /** Machine code, e.g. "STOCK_REQUEST", "SALE_VERIFY". */
  type: string;
  title: string;
  body: string;
  /** Who triggered it (shown as "by X"). */
  actorName?: string | null;
  /** What it's about — lets the resolving action clear it later. */
  entityType?: string;
  entityId?: string;
  /** Where the recipient goes to act, and the button label. */
  actionUrl?: string;
  actionLabel?: string;
};

/** Write one notification row per target (user + each role). Never throws. */
export async function notifyInApp(input: NotifyInput): Promise<void> {
  try {
    const base = {
      category: input.category ?? "INFO",
      type: input.type,
      title: input.title,
      body: input.body,
      actorName: input.actorName ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      actionUrl: input.actionUrl ?? null,
      actionLabel: input.actionLabel ?? null,
    };
    const rows: Array<typeof base & { userId: string | null; role: Role | null }> = [];
    if (input.toUserId) rows.push({ ...base, userId: input.toUserId, role: null });
    for (const role of dedupeRoles(input.toRoles)) rows.push({ ...base, userId: null, role });
    if (rows.length === 0) return;
    await prisma.notification.createMany({ data: rows });
  } catch (e) {
    console.error("[notifyInApp]", input.type, e instanceof Error ? e.message : e);
  }
}

function dedupeRoles(roles?: Role[]): Role[] {
  if (!roles || roles.length === 0) return [];
  return Array.from(new Set(roles));
}

/**
 * Mark every unresolved ACTION notification for an entity as resolved — call this
 * from the workflow action that COMPLETES the task (approve/reject/receive/…), so
 * the recipient's sound stops on their next poll. Never throws.
 */
export async function resolveInApp(entityType: string, entityId: string): Promise<void> {
  try {
    await prisma.notification.updateMany({
      where: { entityType, entityId, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
  } catch (e) {
    console.error("[resolveInApp]", entityType, entityId, e instanceof Error ? e.message : e);
  }
}
