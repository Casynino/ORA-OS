import "server-only";
import { prisma } from "@/lib/db";

/**
 * Exact (unthrottled) recorder for low-volume operational events the Developer
 * Home reads back: WHATSAPP (did a message reach the owner?) and JOB_RUN (did a
 * scheduled job run?). They go in the same SystemEvent table as crashes, but unlike
 * crashes they must be counted exactly, so they skip the crash recorder's
 * de-duplication. Never throws, never stores message text or request data.
 */
export type OpsKind = "WHATSAPP" | "JOB_RUN";

export async function recordOpsEvent(e: { kind: OpsKind; message: string; detail?: string | null }): Promise<void> {
  try {
    await prisma.systemEvent.create({
      data: {
        kind: e.kind,
        message: e.message.slice(0, 300),
        detail: e.detail ? e.detail.slice(0, 1500) : null,
      },
    });
  } catch {
    // Table not created yet, or a database hiccup: the real work must never fail because of this.
  }
}
