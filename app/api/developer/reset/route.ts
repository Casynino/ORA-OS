import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth, unstable_update } from "@/auth";
import { prisma } from "@/lib/db";
import { dashboardPath } from "@/lib/rbac";
import { writeDevAuditSafe, requestMeta } from "@/lib/developer/audit";

// Safety net for a Developer whose "work as" ended by itself (4-hour limit, or the
// person was suspended): the browser still holds the old "working as" cookie, which
// would bounce between areas. This clears it and lands back in the Developer
// console. Only ever acts on a real Developer session.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const realId = user.impersonatedBy?.id ?? (user.role === "DEVELOPER" ? user.id : null);
  if (!realId) return NextResponse.redirect(new URL(dashboardPath(user.role), req.url));

  // Record the automatic end once — only if the Developer's latest start/stop
  // row is a start (so repeated visits don't pile up rows).
  const latest = await prisma.activityLog.findFirst({
    where: { actorId: realId, action: { in: ["DEV_ACT_START", "DEV_ACT_STOP"] } },
    orderBy: { createdAt: "desc" },
    select: { action: true, entityId: true },
  });
  if (latest?.action === "DEV_ACT_START") {
    const dev = await prisma.user.findUnique({ where: { id: realId }, select: { name: true } });
    await writeDevAuditSafe({
      actor: { id: realId, name: dev?.name ?? "Developer" },
      action: "DEV_ACT_STOP",
      entity: "User",
      entityId: latest.entityId,
      summary: "Working-as ended automatically (time limit reached, or the account is no longer available).",
      outcome: "SUCCESS",
      ...requestMeta(await headers()),
    });
  }
  try {
    await unstable_update({ actAs: null } as never);
  } catch {
    /* if this fails the Developer can still sign out and back in */
  }
  return NextResponse.redirect(new URL("/developer", req.url));
}
