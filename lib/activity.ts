import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

type ActivityInput = {
  actorId?: string | null;
  actorName?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
  meta?: Prisma.InputJsonValue;
};

/** If a Developer is currently working as a staff member, who is really behind it. */
async function workingAsContext() {
  try {
    const u = (await auth())?.user;
    return u?.impersonatedBy ? { developer: u.impersonatedBy, as: { id: u.id, name: u.name ?? "" } } : null;
  } catch {
    return null; // no request context (cron / script) → not working-as
  }
}

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
    const wa = await workingAsContext();
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
