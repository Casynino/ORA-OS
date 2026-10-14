import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { workingAsContext } from "@/lib/developer/context";

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
 *
 * When a Developer is working as a staff member, the entry is recorded under the
 * DEVELOPER ("Nino (Developer) as Daeda") — never as the staff member alone — and
 * flagged `developer: true` so the database protects it from edits/deletes.
 */
export async function logActivity(input: ActivityInput) {
  try {
    // Only entries about the person being worked as are re-attributed (not, say,
    // a record logged for some other user).
    const ctx = await workingAsContext();
    const wa = ctx && (!input.actorId || input.actorId === ctx.as.id) ? ctx : null;
    const base = (input.meta ?? undefined) as Record<string, Prisma.InputJsonValue> | undefined;
    await prisma.activityLog.create({
      data: wa
        ? {
            actorId: wa.developer.id,
            actorName: `${wa.developer.name} (Developer) as ${input.actorName ?? wa.as.name}`,
            action: input.action,
            entity: input.entity,
            entityId: input.entityId ?? null,
            // Prefixed so the sentence itself can't be misread as the person's own act.
            summary: `[Done by Developer ${wa.developer.name}] ${input.summary}`,
            meta: {
              ...(base && typeof base === "object" && !Array.isArray(base) ? base : {}),
              developer: true,
              outcome: "SUCCESS",
              actingAs: { id: wa.as.id, name: wa.as.name },
            },
          }
        : {
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
