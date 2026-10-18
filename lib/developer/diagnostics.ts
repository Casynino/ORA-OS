import "server-only";
import { prisma } from "@/lib/db";
import { blobConfigured } from "@/lib/blob-config";
import { notDeleted } from "@/lib/deleted-accounts";
import { BUILD_ID } from "@/lib/build-id";

/**
 * System health for the Developer overview. Reports whether config is PRESENT —
 * never the values — and read-only counts. Each probe is isolated so one failing
 * check can't blank the page.
 */

type EnvCheck = {
  name: string;
  /** Plain-language name shown as the card title. */
  title: string;
  /** What this setting is for. */
  purpose: string;
  /** What happens (in the app) when it is not set. */
  ifMissing: string;
  required: boolean;
};

const ENV_CHECKS: EnvCheck[] = [
  {
    name: "DATABASE_URL",
    title: "Database connection",
    purpose: "How the website talks to the database during normal use. It should be the “pooled” link, which lets many people use the system at the same time.",
    ifMissing: "The whole system stops — nobody can sign in or load any page.",
    required: true,
  },
  {
    name: "DIRECT_URL",
    title: "Direct database link",
    purpose: "A second, direct link used only when the database structure is updated (migrations).",
    ifMissing: "Everyday use still works, but database updates cannot be applied.",
    required: true,
  },
  {
    name: "AUTH_SECRET",
    title: "Login security key",
    purpose: "A private key that signs every login session so nobody can fake being signed in.",
    ifMissing: "Nobody can sign in. Never share or change it casually — changing it signs everyone out.",
    required: true,
  },
  {
    name: "ORA_FILES_READ_WRITE_TOKEN",
    title: "File storage",
    purpose: "Cloud storage for receipts, proofs and report PDFs (Vercel Blob, the public store “ora-files”).",
    ifMissing: "Uploads still work — files are kept inside the database instead. That is fine for now, but the database grows faster. Add it in Vercel when you want faster pages and a lighter database.",
    required: false,
  },
  {
    name: "CALLMEBOT_APIKEY",
    title: "WhatsApp alerts — key",
    purpose: "Lets the system send WhatsApp messages and daily reports to the owner (through CallMeBot).",
    ifMissing: "No WhatsApp alerts or reports are sent. In-app alerts still work.",
    required: false,
  },
  {
    name: "CALLMEBOT_PHONE",
    title: "WhatsApp alerts — number",
    purpose: "The owner's phone number that receives those WhatsApp messages.",
    ifMissing: "No WhatsApp alerts or reports are sent. In-app alerts still work.",
    required: false,
  },
  {
    name: "NEXT_PUBLIC_APP_URL",
    title: "Public site address",
    purpose: "The web address placed inside WhatsApp messages and report links.",
    ifMissing: "Links in messages fall back to the default address.",
    required: false,
  },
];

export type EnvStatus = EnvCheck & { set: boolean };

export async function getDiagnostics() {
  const env: EnvStatus[] = ENV_CHECKS.map((c) => ({
    ...c,
    set:
      c.name === "AUTH_SECRET"
        ? !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET)
        : c.name === "ORA_FILES_READ_WRITE_TOKEN"
          ? blobConfigured()
          : !!process.env[c.name],
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

  const [usersByRole, activity24h, failedDevLogins24h, lastDevLogin, stuckAlerts, recentDev, openActions] = await Promise.all([
    safe(() => prisma.user.groupBy({ by: ["role", "status"], where: { ...notDeleted }, _count: { _all: true } }), []),
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
    // The Developer's own most recent actions (shown on the overview).
    safe(
      () =>
        prisma.activityLog.findMany({
          where: { OR: [{ action: { startsWith: "DEV_" } }, { meta: { path: ["developer"], equals: true } }] },
          orderBy: { createdAt: "desc" },
          take: 6,
          select: { id: true, action: true, summary: true, createdAt: true, meta: true },
        }),
      [],
    ),
    // Every ACTION alert still waiting for someone (normal work in progress).
    safe(() => prisma.notification.count({ where: { category: "ACTION", resolvedAt: null } }), 0),
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
    recentDev,
    openActions,
  };
}
