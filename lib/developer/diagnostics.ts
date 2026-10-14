import "server-only";
import { prisma } from "@/lib/db";
import { BUILD_ID } from "@/lib/build-id";

/**
 * System health for the Developer overview. Reports whether config is PRESENT —
 * never the values — and read-only counts. Each probe is isolated so one failing
 * check can't blank the page.
 */

const ENV_CHECKS: { name: string; note: string; required: boolean }[] = [
  { name: "DATABASE_URL", note: "App database (should be the pooled connection)", required: true },
  { name: "DIRECT_URL", note: "Direct connection used for migrations", required: true },
  { name: "AUTH_SECRET", note: "Signs login sessions", required: true },
  { name: "BLOB_READ_WRITE_TOKEN", note: "File storage for receipts/proofs", required: false },
  { name: "CALLMEBOT_APIKEY", note: "Admin WhatsApp alerts (key)", required: false },
  { name: "CALLMEBOT_PHONE", note: "Admin WhatsApp alerts (number)", required: false },
  { name: "NEXT_PUBLIC_APP_URL", note: "Public site URL", required: false },
];

export type EnvStatus = { name: string; note: string; required: boolean; set: boolean };

export async function getDiagnostics() {
  const env: EnvStatus[] = ENV_CHECKS.map((c) => ({
    ...c,
    set: c.name === "AUTH_SECRET" ? !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET) : !!process.env[c.name],
  }));
  const pooled = /-pooler/i.test(process.env.DATABASE_URL ?? "");

  let dbOk = false;
  let dbMs: number | null = null;
  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbMs = Date.now() - t0;
    dbOk = true;
  } catch {
    /* reported as down */
  }

  const day = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  };

  const [usersByRole, activity24h, failedDevLogins24h, lastDevLogin, stuckAlerts] = await Promise.all([
    safe(() => prisma.user.groupBy({ by: ["role", "status"], _count: { _all: true } }), []),
    safe(() => prisma.activityLog.count({ where: { createdAt: { gte: day } } }), 0),
    safe(
      () =>
        prisma.activityLog.count({
          where: { action: { in: ["DEV_LOGIN_FAILED", "DEV_LOGIN_BLOCKED"] }, createdAt: { gte: day } },
        }),
      0,
    ),
    safe(
      () =>
        prisma.activityLog.findFirst({
          where: { action: "DEV_LOGIN" },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
      null,
    ),
    // ACTION alerts still unresolved after a day — usually a workflow that
    // forgot to clear its notification (a "stuck ring").
    safe(
      () =>
        prisma.notification.count({
          where: { category: "ACTION", resolvedAt: null, createdAt: { lt: day } },
        }),
      0,
    ),
  ]);

  return {
    build: BUILD_ID,
    node: process.version,
    nodeEnv: process.env.NODE_ENV,
    env,
    pooled,
    dbOk,
    dbMs,
    usersByRole,
    activity24h,
    failedDevLogins24h,
    lastDevLogin: lastDevLogin?.createdAt ?? null,
    stuckAlerts,
  };
}
