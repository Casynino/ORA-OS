import "server-only";
import { prisma } from "@/lib/db";

/**
 * Which suspended accounts may the Developer console RE-ACTIVATE?
 *
 * Only accounts the Developer console itself suspended, and that nobody has
 * changed since. An account that is PENDING approval, was rejected, or was
 * suspended by the Admin/Finance is a business decision — the Developer must not
 * be able to overrule it. Fails closed: if in doubt, it's not eligible.
 *
 * Rule for a user to be eligible, all of:
 *   1. status is SUSPENDED right now,
 *   2. the latest SUCCESSFUL Developer status change for it was → SUSPENDED,
 *   3. the user row hasn't been modified since the latest successful Developer
 *      action on it (User.updatedAt ≤ that action + a small clock grace) — so a
 *      later Admin/Finance change of any kind makes it ineligible.
 */
const CLOCK_GRACE_MS = 10_000;

type DevMeta = { outcome?: string; after?: { status?: string } } | null;

export async function devActivatableIds(ids: string[]): Promise<Set<string>> {
  const eligible = new Set<string>();
  if (ids.length === 0) return eligible;

  const [users, rows] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids }, status: "SUSPENDED" },
      select: { id: true, updatedAt: true },
    }),
    prisma.activityLog.findMany({
      where: {
        entity: "User",
        entityId: { in: ids },
        action: { in: ["DEV_USER_STATUS_CHANGED", "DEV_USER_SIGNED_OUT"] },
      },
      orderBy: { createdAt: "desc" },
      select: { entityId: true, action: true, createdAt: true, meta: true },
    }),
  ]);

  // Successful developer rows per user, newest first.
  const byUser = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!r.entityId || (r.meta as DevMeta)?.outcome !== "SUCCESS") continue;
    const list = byUser.get(r.entityId) ?? [];
    list.push(r);
    byUser.set(r.entityId, list);
  }

  for (const u of users) {
    const mine = byUser.get(u.id) ?? [];
    const lastChange = mine.find((r) => r.action === "DEV_USER_STATUS_CHANGED");
    if (!lastChange || (lastChange.meta as DevMeta)?.after?.status !== "SUSPENDED") continue;
    const lastDevAction = mine[0].createdAt; // newest of either kind
    if (u.updatedAt.getTime() <= lastDevAction.getTime() + CLOCK_GRACE_MS) eligible.add(u.id);
  }
  return eligible;
}
