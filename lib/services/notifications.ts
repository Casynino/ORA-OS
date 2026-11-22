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

// The change token the bell sends back: newest notification id : unread count : waiting ACTION
// count (capped at 200, the size of the waiting list). getInboxFor and getInboxVersion MUST build
// it the same way, or an unchanged inbox would look changed and be downloaded again.
const WAITING_CAP = 200;
const NEWEST_FIRST = [{ createdAt: "desc" }, { id: "desc" }] as const; // id breaks same-millisecond ties
const inboxToken = (newestId: string | undefined, unread: number, waiting: number) =>
  `${newestId ?? "0"}:${unread}:${Math.min(waiting, WAITING_CAP)}`;

/**
 * Just the change token: three tiny queries (one id, two counts) instead of the 40-row inbox.
 * The bell sends its token on every 12 s poll and downloads the full inbox only when it moved,
 * which keeps the database's data transfer (billed per GB) small. null = couldn't tell, so send the full inbox.
 */
export async function getInboxVersion(user: { id: string; role: Role }): Promise<string | null> {
  const where = audienceWhere(user.id, user.role);
  try {
    const [newest, unread, waiting] = await Promise.all([
      prisma.notification.findFirst({ where, orderBy: [...NEWEST_FIRST], select: { id: true } }),
      prisma.notification.count({ where: { ...where, readAt: null } }),
      prisma.notification.count({ where: { ...where, category: "ACTION", resolvedAt: null } }),
    ]);
    return inboxToken(newest?.id, unread, waiting);
  } catch {
    return null;
  }
}

/** Everything the bell needs in one poll. Degrades to empty if the table is missing. */
export async function getInboxFor(user: { id: string; role: Role }): Promise<NotifPulse> {
  const where = audienceWhere(user.id, user.role);
  try {
    const [items, unread, waiting] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [...NEWEST_FIRST],
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
        take: WAITING_CAP,
      }),
    ]);
    const dtos = items.map(toDTO);
    const waitingIds = waiting.map((w) => w.id);
    return { items: dtos, waitingIds, unread, v: inboxToken(dtos[0]?.id, unread, waitingIds.length) };
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
