import "server-only";
import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { NotifDTO, NotifPulse } from "@/lib/notifications/types";

// Read + mutate the current user's notification inbox. A user sees a row when it
// targets them directly (userId) OR broadcasts to their role (userId null + role).

function audienceWhere(userId: string, role: Role): Prisma.NotificationWhereInput {
  return { OR: [{ userId }, { userId: null, role }] };
}

function toDTO(n: {
  id: string;
  category: "ACTION" | "INFO";
  type: string;
  title: string;
  body: string;
  actorName: string | null;
  actionUrl: string | null;
  actionLabel: string | null;
  readAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
}): NotifDTO {
  return {
    id: n.id,
    category: n.category,
    type: n.type,
    title: n.title,
    body: n.body,
    actorName: n.actorName,
    actionUrl: n.actionUrl,
    actionLabel: n.actionLabel,
    read: n.readAt !== null,
    resolved: n.resolvedAt !== null,
    createdAt: n.createdAt.toISOString(),
  };
}

/** Everything the bell needs in one poll. Degrades to empty if the table is missing. */
export async function getInboxFor(user: { id: string; role: Role }): Promise<NotifPulse> {
  const where = audienceWhere(user.id, user.role);
  try {
    const [items, unread, waiting] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 40,
        select: {
          id: true, category: true, type: true, title: true, body: true,
          actorName: true, actionUrl: true, actionLabel: true,
          readAt: true, resolvedAt: true, createdAt: true,
        },
      }),
      prisma.notification.count({ where: { ...where, readAt: null } }),
      prisma.notification.findMany({
        where: { ...where, category: "ACTION", resolvedAt: null },
        select: { id: true },
        take: 200,
      }),
    ]);
    const dtos = items.map(toDTO);
    const waitingIds = waiting.map((w) => w.id);
    return { items: dtos, waitingIds, unread, v: `${dtos[0]?.id ?? "0"}:${unread}:${waitingIds.length}` };
  } catch (e) {
    console.error("[getInboxFor]", e instanceof Error ? e.message : e);
    return { items: [], waitingIds: [], unread: 0, v: "0:0:0" };
  }
}

/** Mark one notification read (scoped to the user's audience). */
export async function markNotificationRead(user: { id: string; role: Role }, id: string): Promise<void> {
  try {
    await prisma.notification.updateMany({
      where: { id, readAt: null, ...audienceWhere(user.id, user.role) },
      data: { readAt: new Date() },
    });
  } catch (e) {
    console.error("[markNotificationRead]", e instanceof Error ? e.message : e);
  }
}

/** Mark every unread notification for this user read. */
export async function markAllNotificationsRead(user: { id: string; role: Role }): Promise<void> {
  try {
    await prisma.notification.updateMany({
      where: { readAt: null, ...audienceWhere(user.id, user.role) },
      data: { readAt: new Date() },
    });
  } catch (e) {
    console.error("[markAllNotificationsRead]", e instanceof Error ? e.message : e);
  }
}
