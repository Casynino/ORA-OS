import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type ActivityInput = {
  actorId?: string | null;
  actorName?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
  meta?: Prisma.InputJsonValue;
};

/**
 * Append a line to the immutable activity log. Used across every state change
 * so the admin "full activity logs" view tells the complete story.
 */
export async function logActivity(input: ActivityInput) {
  try {
    await prisma.activityLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorName: input.actorName ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        summary: input.summary,
        meta: input.meta ?? undefined,
      },
    });
  } catch {
    // Logging must never break the primary operation.
  }
}
