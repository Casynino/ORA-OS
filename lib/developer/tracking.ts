import "server-only";
import { prisma } from "@/lib/db";
import { writeDevAudit } from "@/lib/developer/audit";
import { resumeTracking } from "@/lib/developer/errors";

/**
 * Makes sure crashes and failed sign-ins are being recorded. The Developer's whole job is to
 * see what is wrong, so this switches error tracking on by itself the first time the Developer
 * opens Home (additive + idempotent: one small table, no business data touched; audited).
 * Never throws — Home still opens, and the manual button stays as a fallback.
 */
export async function ensureErrorTracking(actor: { id: string; name: string }): Promise<void> {
  try {
    const row = await prisma.$queryRaw<{ t: string | null }[]>`SELECT to_regclass('"SystemEvent"')::text AS t`;
    if (row[0]?.t) return;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`CREATE TABLE IF NOT EXISTS "SystemEvent" (
        "id" TEXT NOT NULL,
        "kind" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "path" TEXT,
        "method" TEXT,
        "digest" TEXT,
        "detail" TEXT,
        "ip" TEXT,
        "count" INTEGER NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SystemEvent_pkey" PRIMARY KEY ("id")
      )`;
      await tx.$executeRaw`ALTER TABLE "SystemEvent" ADD COLUMN IF NOT EXISTS "count" INTEGER NOT NULL DEFAULT 1`;
      await tx.$executeRaw`CREATE INDEX IF NOT EXISTS "SystemEvent_createdAt_idx" ON "SystemEvent"("createdAt")`;
      await tx.$executeRaw`CREATE INDEX IF NOT EXISTS "SystemEvent_kind_createdAt_idx" ON "SystemEvent"("kind", "createdAt")`;
      await writeDevAudit(tx, {
        actor,
        action: "DEV_ERROR_TRACKING_ENABLED",
        entity: "System",
        summary: "Error tracking was switched on automatically (created the SystemEvent table).",
        outcome: "SUCCESS",
      });
    });
    resumeTracking();
  } catch {
    /* leave it to the manual button */
  }
}
