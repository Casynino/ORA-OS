import "server-only";
import { prisma } from "@/lib/db";
import { getDiagnostics } from "@/lib/developer/diagnostics";
import { JOB_KEYS, type JobKey } from "@/lib/developer/job-runs";
import { notDeleted } from "@/lib/deleted-accounts";

/**
 * Everything the Developer Home shows: usage, who signs in, speed, size,
 * errors and a plain-language "problems found" list. READ-ONLY, and every probe is
 * isolated so one failing query can't blank the page.
 */

const TZ = "Africa/Dar_es_Salaam";
const DAYS = 14;
/** auth.ts records every sign-in with an email that has no account under this one message (the typed email is never stored). */
const UNKNOWN_EMAIL = "Sign-in with an email that has no account";
/** vercel.json runs the daily report at 16:00 UTC = 19:00 EAT, and the credit reminder at 04:00 UTC = 07:00 EAT. */
const DAILY_REPORT_HOUR_EAT = 19;
const CREDIT_REMINDER_HOUR_EAT = 7;
/** After the scheduled hour a report is only called missing once this many hours have passed (cron timing + build time). */
const REPORT_GRACE_HOURS = 3;

export type Level = "critical" | "warning" | "info";
/** `link.href` is either an in-page tab ("#errors") or an outside page (Vercel, Neon). */
export type Problem = { level: Level; title: string; detail: string; hint: string; link?: { label: string; href: string } };

const VERCEL_ENV = { label: "Open Vercel settings", href: "https://vercel.com/dashboard" };
const NEON = { label: "Open Neon (database)", href: "https://console.neon.tech" };
export type Probe = { label: string; ms: number; ok: boolean };

export type Monitor = Awaited<ReturnType<typeof getMonitor>>;

/** "2026-10-17" for the last N days in Tanzania time, oldest first. */
function lastDays(n: number): string[] {
  const out: string[] = [];
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  for (let i = n - 1; i >= 0; i--) out.push(fmt.format(new Date(Date.now() - i * 86_400_000)));
  return out;
}

/** "5 hours ago" up to two days, then "90 days ago". */
const agoText = (ms: number) => (ms < 48 * 3_600_000 ? `${Math.floor(ms / 3_600_000)} hours ago` : `${Math.floor(ms / 86_400_000)} days ago`);

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/** Plain-language browser/device from a User-Agent string. */
export function describeAgent(ua: string | null | undefined): { browser: string; os: string; mobile: boolean } {
  const s = ua ?? "";
  const browser = /Edg\//.test(s)
    ? "Edge"
    : /OPR\/|Opera/.test(s)
      ? "Opera"
      : /Firefox\//.test(s)
        ? "Firefox"
        : /Chrome\//.test(s) || /CriOS\//.test(s)
          ? "Chrome"
          : /Safari\//.test(s)
            ? "Safari"
            : s
              ? "Other browser"
              : "Unknown";
  const os = /Windows/.test(s)
    ? "Windows"
    : /Android/.test(s)
      ? "Android"
      : /iPhone|iPad|iOS/.test(s)
        ? "iPhone/iPad"
        : /Mac OS X|Macintosh/.test(s)
          ? "Mac"
          : /Linux/.test(s)
            ? "Linux"
            : "Unknown";
  return { browser, os, mobile: /Android|iPhone|iPad|Mobile/.test(s) };
}

async function timed(label: string, fn: () => Promise<unknown>): Promise<Probe> {
  const t0 = Date.now();
  try {
    await fn();
    return { label, ms: Date.now() - t0, ok: true };
  } catch {
    return { label, ms: Date.now() - t0, ok: false };
  }
}

export async function getMonitor() {
  const days = lastDays(DAYS);
  const since = new Date(Date.now() - DAYS * 86_400_000);
  const since7 = new Date(Date.now() - 7 * 86_400_000);
  const since24 = new Date(Date.now() - 86_400_000);
  const since30 = new Date(Date.now() - 30 * 86_400_000);

  const diag = await getDiagnostics();

  // ── Speed: warm the connection, then time a few real queries one by one. ──
  await safe(() => prisma.$queryRaw`SELECT 1`, null);
  const probes: Probe[] = [];
  probes.push(await timed("Simple ping", () => prisma.$queryRaw`SELECT 1`));
  probes.push(await timed("Find one account", () => prisma.user.findFirst({ select: { id: true } })));
  probes.push(await timed("Count today's activity", () => prisma.activityLog.count({ where: { createdAt: { gte: since24 } } })));
  probes.push(
    await timed("Load latest 50 activity lines", () =>
      prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    ),
  );
  probes.push(await timed("Count open alerts", () => prisma.notification.count({ where: { resolvedAt: null } })));
  probes.push(await timed("Load product list", () => prisma.product.findMany({ take: 50 })));

  const [
    loginsByDay,
    activityByDay,
    activityByHour,
    topActors,
    modules,
    recentLogins,
    signedIn24,
    signedIn7,
    dbSize,
    tables,
    inactive,
    neverSignedIn,
    suspended,
    negWarehouse,
    negRep,
    overpaid,
    growth,
    lastDaily,
    lastReport,
    reportSettings,
  ] = await Promise.all([
    safe(
      () =>
        prisma.$queryRaw<{ day: string; role: string; n: number }[]>`
          SELECT to_char(((l."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Dar_es_Salaam')::date, 'YYYY-MM-DD') AS day,
                 u."role"::text AS role, count(*)::int AS n
          FROM "LoginEvent" l JOIN "User" u ON u.id = l."userId"
          WHERE l."createdAt" >= ${since}
          GROUP BY 1, 2`,
      [],
    ),
    safe(
      () =>
        prisma.$queryRaw<{ day: string; staff: number; dev: number }[]>`
          SELECT to_char((("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Dar_es_Salaam')::date, 'YYYY-MM-DD') AS day,
                 count(*) FILTER (WHERE NOT (action LIKE 'DEV\\_%' OR coalesce(meta ->> 'developer', '') = 'true'))::int AS staff,
                 count(*) FILTER (WHERE action LIKE 'DEV\\_%' OR coalesce(meta ->> 'developer', '') = 'true')::int AS dev
          FROM "ActivityLog"
          WHERE "createdAt" >= ${since}
          GROUP BY 1`,
      [],
    ),
    safe(
      () =>
        prisma.$queryRaw<{ h: number; n: number }[]>`
          SELECT extract(hour FROM (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Dar_es_Salaam'))::int AS h, count(*)::int AS n
          FROM "ActivityLog"
          WHERE "createdAt" >= ${since} AND NOT (action LIKE 'DEV\\_%' OR coalesce(meta ->> 'developer', '') = 'true')
          GROUP BY 1`,
      [],
    ),
    safe(
      () =>
        prisma.$queryRaw<{ name: string; n: number }[]>`
          SELECT coalesce("actorName", 'System') AS name, count(*)::int AS n
          FROM "ActivityLog"
          WHERE "createdAt" >= ${since7} AND NOT (action LIKE 'DEV\\_%' OR coalesce(meta ->> 'developer', '') = 'true')
          GROUP BY 1 ORDER BY n DESC LIMIT 8`,
      [],
    ),
    safe(
      () =>
        prisma.$queryRaw<{ name: string; n: number }[]>`
          SELECT entity AS name, count(*)::int AS n
          FROM "ActivityLog"
          WHERE "createdAt" >= ${since7} AND NOT (action LIKE 'DEV\\_%' OR coalesce(meta ->> 'developer', '') = 'true')
          GROUP BY 1 ORDER BY n DESC LIMIT 8`,
      [],
    ),
    safe(
      () =>
        prisma.loginEvent.findMany({
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true,
            ip: true,
            userAgent: true,
            createdAt: true,
            user: { select: { name: true, role: true, avatar: true } },
          },
        }),
      [],
    ),
    safe(
      async () => (await prisma.loginEvent.groupBy({ by: ["userId"], where: { createdAt: { gte: since24 } } })).length,
      0,
    ),
    safe(
      async () => (await prisma.loginEvent.groupBy({ by: ["userId"], where: { createdAt: { gte: since7 } } })).length,
      0,
    ),
    safe(async () => Number((await prisma.$queryRaw<{ b: bigint }[]>`SELECT pg_database_size(current_database())::bigint AS b`)[0].b), 0),
    safe(
      async () =>
        (
          await prisma.$queryRaw<{ name: string; bytes: bigint; rows: bigint }[]>`
            SELECT relname AS name, pg_total_relation_size(relid)::bigint AS bytes, n_live_tup::bigint AS rows
            FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 8`
        ).map((t) => ({ name: t.name, bytes: Number(t.bytes), rows: Number(t.rows) })),
      [] as { name: string; bytes: number; rows: number }[],
    ),
    safe(
      () =>
        prisma.user.findMany({
          where: { status: "ACTIVE", role: { not: "DEVELOPER" }, lastLoginAt: { lt: since30 } },
          orderBy: { lastLoginAt: "asc" },
          take: 8,
          select: { id: true, name: true, role: true, lastLoginAt: true },
        }),
      [],
    ),
    safe(
      () =>
        prisma.user.findMany({
          where: { status: "ACTIVE", role: { not: "DEVELOPER" }, lastLoginAt: null },
          take: 8,
          select: { id: true, name: true, role: true, createdAt: true },
        }),
      [],
    ),
    safe(() => prisma.user.count({ where: { status: "SUSPENDED", ...notDeleted } }), 0),
    safe(
      async () =>
        Number(
          (
            await prisma.$queryRaw<{ n: bigint }[]>`
              SELECT count(*)::bigint AS n FROM "WarehouseStock" WHERE "onHand" < 0 OR "reserved" < 0 OR "reserved" > "onHand"`
          )[0].n,
        ),
      null as number | null,
    ),
    safe(
      async () =>
        Number(
          (await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM "RepStock" WHERE "sellableQty" < 0 OR "sampleQty" < 0`)[0].n,
        ),
      null as number | null,
    ),
    safe(
      async () =>
        Number(
          (
            await prisma.$queryRaw<{ n: bigint }[]>`
              SELECT count(*)::bigint AS n FROM "FieldSale" WHERE "voided" = false AND ("amountPaid" > "total" OR "amountPaid" < 0)`
          )[0].n,
        ),
      null as number | null,
    ),
    safe(
      () =>
        prisma.$queryRaw<{ label: string; total: number; recent: number }[]>`
          SELECT 'People' AS label, count(*)::int AS total, count(*) FILTER (WHERE "createdAt" >= ${since7})::int AS recent FROM "User"
          UNION ALL SELECT 'Customers', count(*)::int, count(*) FILTER (WHERE "createdAt" >= ${since7})::int FROM "FieldCustomer"
          UNION ALL SELECT 'Sales recorded', count(*)::int, count(*) FILTER (WHERE "createdAt" >= ${since7})::int FROM "FieldSale"
          UNION ALL SELECT 'Payments collected', count(*)::int, count(*) FILTER (WHERE "createdAt" >= ${since7})::int FROM "FieldPayment"
          UNION ALL SELECT 'Partner orders', count(*)::int, count(*) FILTER (WHERE "createdAt" >= ${since7})::int FROM "Request"
          UNION ALL SELECT 'Stock movements', count(*)::int, count(*) FILTER (WHERE "createdAt" >= ${since7})::int FROM "StockMovement"
          UNION ALL SELECT 'Activity log lines', count(*)::int, count(*) FILTER (WHERE "createdAt" >= ${since7})::int FROM "ActivityLog"
          UNION ALL SELECT 'Alerts sent', count(*)::int, count(*) FILTER (WHERE "createdAt" >= ${since7})::int FROM "Notification"
          UNION ALL SELECT 'Photos and files', count(*)::int, count(*) FILTER (WHERE "createdAt" >= ${since7})::int FROM "Attachment"`,
      [],
    ),
    safe(() => prisma.report.findFirst({ where: { type: "DAILY" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }), null),
    safe(() => prisma.report.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true, whatsappSent: true, title: true } }), null),
    safe(() => prisma.reportSettings.findUnique({ where: { id: "singleton" }, select: { dailyEnabled: true } }), null),
  ]);

  // ── Errors + failed sign-ins (only once the SystemEvent table exists). ──
  // `tracking` is false ONLY when the table is missing; any other failure is a
  // temporary read problem and is reported as "incomplete" instead.
  let tracking = true;
  const incomplete: string[] = [];
  const events = await (async () => {
    try {
      const [errors24, errorsByDay, groupedErrors, lastErr, failed24, recentFailed] = await Promise.all([
        prisma.systemEvent.aggregate({ _sum: { count: true }, where: { kind: "SERVER_ERROR", createdAt: { gte: since24 } } }),
        prisma.$queryRaw<{ day: string; kind: string; n: number }[]>`
          SELECT to_char((("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Dar_es_Salaam')::date, 'YYYY-MM-DD') AS day,
                 kind, coalesce(sum("count"), 0)::int AS n
          FROM "SystemEvent" WHERE "createdAt" >= ${since} GROUP BY 1, 2`,
        prisma.$queryRaw<{ message: string; path: string | null; n: number; last: Date; detail: string | null }[]>`
          SELECT message, path, coalesce(sum("count"), 0)::int AS n, max("createdAt") AS last,
                 (array_agg(detail ORDER BY "createdAt" DESC))[1] AS detail
          FROM "SystemEvent" WHERE kind = 'SERVER_ERROR' AND "createdAt" >= ${since7}
          GROUP BY 1, 2 ORDER BY max("createdAt") DESC LIMIT 10`,
        prisma.systemEvent.findFirst({
          where: { kind: "SERVER_ERROR" },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        prisma.systemEvent.aggregate({ _sum: { count: true }, where: { kind: "LOGIN_FAILED", createdAt: { gte: since24 } } }),
        prisma.systemEvent.findMany({
          where: { kind: "LOGIN_FAILED" },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { id: true, message: true, ip: true, createdAt: true, count: true },
        }),
      ]);
      return {
        errors24: errors24._sum.count ?? 0,
        errorsByDay,
        groupedErrors,
        lastError: lastErr?.createdAt ?? null,
        failed24: failed24._sum.count ?? 0,
        recentFailed,
      };
    } catch (e) {
      const text = `${(e as { code?: string })?.code ?? ""} ${(e as { message?: string })?.message ?? ""} ${JSON.stringify((e as { meta?: unknown })?.meta ?? "")}`;
      if (/P2021|42P01|does not exist/i.test(text)) tracking = false;
      else incomplete.push("crashes and failed sign-ins");
      return {
        errors24: 0,
        errorsByDay: [] as { day: string; kind: string; n: number }[],
        groupedErrors: [] as { message: string; path: string | null; n: number; last: Date; detail: string | null }[],
        lastError: null as Date | null,
        failed24: 0,
        recentFailed: [] as { id: string; message: string; ip: string | null; createdAt: Date; count: number }[],
      };
    }
  })();

  // ── Messages and scheduled jobs (written by sendWhatsApp and the two cron routes). ──
  type JobRun = { job: JobKey; at: Date; ok: boolean; ms: number | null; note: string | null };
  const ops = await (async () => {
    const empty = {
      wa24: { sent: 0, failed: 0, skipped: 0 },
      wa7Failed: 0,
      waSince: null as Date | null,
      waByDay: [] as { day: string; status: string; n: number }[],
      waTrouble: [] as { id: string; status: string; detail: string | null; createdAt: Date }[],
      jobRuns: [] as { job: JobKey; last: JobRun | null; lastOk: JobRun | null }[],
      failedByIp: [] as { ip: string; tries: number; accounts: number; unknown: number; last: Date }[],
    };
    if (!tracking) return empty;
    try {
      const [wa24Rows, wa7, waFirst, waByDay, waTrouble, jobRows, failedByIp] = await Promise.all([
        prisma.systemEvent.groupBy({ by: ["message"], where: { kind: "WHATSAPP", createdAt: { gte: since24 } }, _sum: { count: true } }),
        prisma.systemEvent.aggregate({ _sum: { count: true }, where: { kind: "WHATSAPP", message: "FAILED", createdAt: { gte: since7 } } }),
        prisma.systemEvent.aggregate({ _min: { createdAt: true }, where: { kind: "WHATSAPP" } }),
        prisma.$queryRaw<{ day: string; status: string; n: number }[]>`
          SELECT to_char((("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Dar_es_Salaam')::date, 'YYYY-MM-DD') AS day,
                 message AS status, coalesce(sum("count"), 0)::int AS n
          FROM "SystemEvent" WHERE kind = 'WHATSAPP' AND "createdAt" >= ${since} GROUP BY 1, 2`,
        prisma.systemEvent.findMany({
          where: { kind: "WHATSAPP", message: { in: ["FAILED", "SKIPPED"] } },
          orderBy: { createdAt: "desc" },
          take: 15,
          select: { id: true, message: true, detail: true, createdAt: true },
        }),
        // The newest run and the newest good run of each job, however long ago (a job that has been dead for months must still show as late).
        Promise.all(
          JOB_KEYS.map(async (job) => {
            const [last, lastOk] = await Promise.all([
              prisma.systemEvent.findFirst({ where: { kind: "JOB_RUN", message: job }, orderBy: { createdAt: "desc" }, select: { detail: true, createdAt: true } }),
              prisma.systemEvent.findFirst({
                where: { kind: "JOB_RUN", message: job, detail: { contains: '"ok":true' } },
                orderBy: { createdAt: "desc" },
                select: { detail: true, createdAt: true },
              }),
            ]);
            return { job, last, lastOk };
          }),
        ),
        prisma.$queryRaw<{ ip: string; tries: number; accounts: number; unknown: number; last: Date }[]>`
          SELECT ip, coalesce(sum("count"), 0)::int AS tries,
                 count(DISTINCT message) FILTER (WHERE message <> ${UNKNOWN_EMAIL})::int AS accounts,
                 coalesce(sum("count") FILTER (WHERE message = ${UNKNOWN_EMAIL}), 0)::int AS unknown,
                 max("createdAt") AS last
          FROM "SystemEvent" WHERE kind = 'LOGIN_FAILED' AND ip IS NOT NULL AND "createdAt" >= ${since7}
          GROUP BY ip ORDER BY tries DESC, last DESC LIMIT 8`,
      ]);
      const wa = (status: string) => wa24Rows.find((r) => r.message === status)?._sum.count ?? 0;
      const toRun = (job: JobKey, e: { detail: string | null; createdAt: Date } | null): JobRun | null => {
        if (!e) return null;
        let d: { ok?: boolean; ms?: number; note?: string | null } = {};
        try {
          d = JSON.parse(e.detail ?? "{}");
        } catch {
          // keep the defaults: a row we cannot read counts as a failed run
        }
        return { job, at: e.createdAt, ok: d.ok === true, ms: typeof d.ms === "number" ? d.ms : null, note: d.note ?? null };
      };
      const jobRuns = jobRows.map((r) => ({ job: r.job, last: toRun(r.job, r.last), lastOk: toRun(r.job, r.lastOk) }));
      return {
        wa24: { sent: wa("SENT"), failed: wa("FAILED"), skipped: wa("SKIPPED") },
        wa7Failed: wa7._sum.count ?? 0,
        waSince: waFirst._min.createdAt ?? null,
        waByDay,
        waTrouble: waTrouble.map((t) => ({ id: t.id, status: t.message, detail: t.detail, createdAt: t.createdAt })),
        jobRuns,
        failedByIp,
      };
    } catch {
      incomplete.push("message and job history");
      return empty;
    }
  })();

  const JOB_META: Record<JobKey, { title: string; schedule: string }> = {
    "daily-report": { title: "Daily report (and the month-end report)", schedule: `${String(DAILY_REPORT_HOUR_EAT).padStart(2, "0")}:00 every day` },
    "credit-reminder": { title: "Morning credit reminder", schedule: `${String(CREDIT_REMINDER_HOUR_EAT).padStart(2, "0")}:00 every day` },
  };
  const LATE_AFTER_MS = 36 * 3_600_000; // both jobs are daily: late once a run is 1.5 days old
  const jobs = JOB_KEYS.map((key) => {
    const found = ops.jobRuns.find((r) => r.job === key);
    const last = found?.last ?? null;
    const lastOk = found?.lastOk ?? null;
    const state: "none" | "ok" | "late" | "failed" = !last
      ? "none"
      : !last.ok
        ? "failed"
        : Date.now() - last.at.getTime() > LATE_AFTER_MS
          ? "late"
          : "ok";
    return { key, ...JOB_META[key], last, lastOk, state };
  });

  const eatDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const [dailyReports, firstDaily, lastMonthly] = await Promise.all([
    safe(
      () =>
        prisma.report.findMany({
          where: { type: "DAILY", periodStart: { gte: new Date(Date.now() - 10 * 86_400_000) } },
          orderBy: { createdAt: "desc" },
          select: { periodStart: true, createdAt: true, whatsappSent: true },
        }),
      null,
    ),
    safe(() => prisma.report.findFirst({ where: { type: "DAILY" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }), null),
    safe(
      () => prisma.report.findFirst({ where: { type: "MONTHLY" }, orderBy: { createdAt: "desc" }, select: { title: true, createdAt: true, whatsappSent: true } }),
      null,
    ),
  ]);
  if (dailyReports === null) incomplete.push("daily report history");
  // Who the reports are for: the one active owner account, by the nickname used in greetings.
  const owners = await safe(
    () => prisma.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, orderBy: { createdAt: "asc" }, take: 2, select: { name: true, preferredName: true } }),
    [],
  );
  const ownerName = owners.length === 1 ? owners[0].preferredName?.trim() || owners[0].name.trim().split(/\s+/)[0] || null : null;
  const waConfigured = !!(process.env.CALLMEBOT_APIKEY && process.env.CALLMEBOT_PHONE);
  const dailyEnabled = reportSettings?.dailyEnabled !== false;
  const eatHourNow = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date()));
  const reportDays = days
    .slice(-7)
    .reverse()
    .map((day) => {
      const r = dailyReports?.find((x) => eatDay(x.periodStart) === day);
      const state: "ok" | "unsent" | "built" | "waiting" | "before" | "off" | "missing" | "unknown" = !dailyReports
        ? "unknown"
        : r
        ? r.whatsappSent
          ? "ok"
          : waConfigured
            ? "unsent"
            : "built"
        : day === days[days.length - 1] && eatHourNow < DAILY_REPORT_HOUR_EAT + REPORT_GRACE_HOURS
          ? "waiting"
          : !firstDaily || day < eatDay(firstDaily.createdAt)
            ? "before"
            : !dailyEnabled
              ? "off"
              : "missing";
      return { day, state, builtAt: r?.createdAt ?? null };
    });
  const waSeries = days.map((day) => {
    const n = (status: string) => ops.waByDay.find((x) => x.day === day && x.status === status)?.n ?? 0;
    return { day, sent: n("SENT"), failed: n("FAILED"), skipped: n("SKIPPED") };
  });

  // ── Build the day-by-day series. ──
  const ROLES = ["ADMIN", "FINANCE", "WAREHOUSE", "SALES_REP", "PARTNER", "DEVELOPER"] as const;
  const loginSeries = days.map((day) => {
    const row: Record<string, number> = {};
    for (const r of ROLES) row[r] = loginsByDay.find((x) => x.day === day && x.role === r)?.n ?? 0;
    return { day, ...row } as { day: string } & Record<(typeof ROLES)[number], number>;
  });
  const activitySeries = days.map((day) => {
    const x = activityByDay.find((a) => a.day === day);
    return { day, staff: x?.staff ?? 0, dev: x?.dev ?? 0 };
  });
  const errorSeries = days.map((day) => ({
    day,
    errors: events.errorsByDay.find((e) => e.day === day && e.kind === "SERVER_ERROR")?.n ?? 0,
    logins: events.errorsByDay.find((e) => e.day === day && e.kind === "LOGIN_FAILED")?.n ?? 0,
  }));
  const hourSeries = Array.from({ length: 24 }, (_, h) => ({ hour: h, n: activityByHour.find((a) => a.h === h)?.n ?? 0 }));

  // ── Problems found. ──
  const problems: Problem[] = [];
  const slowest = probes.reduce((m, p) => Math.max(m, p.ms), 0);
  const failedProbes = probes.filter((p) => !p.ok);
  const avgMs = Math.round(probes.reduce((s, p) => s + p.ms, 0) / Math.max(1, probes.length));
  if (!diag.dbOk || failedProbes.length === probes.length)
    problems.push({
      level: "critical",
      title: "The database cannot be reached",
      detail: "People cannot sign in or load pages right now.",
      hint: "Check the Neon dashboard for an outage and confirm the DATABASE_URL setting in Vercel.",
      link: NEON,
    });
  else if (failedProbes.length)
    problems.push({
      level: "warning",
      title: `${failedProbes.length} database check${failedProbes.length > 1 ? "s" : ""} failed`,
      detail: failedProbes.map((p) => p.label).join(", "),
      hint: "Check the database in the Neon dashboard; if it keeps happening, tell me.",
    });
  if (diag.dbOk && avgMs > 400)
    problems.push({
      level: "warning",
      title: "The database is slow",
      detail: `Checks averaged ${avgMs} ms (healthy is under 150 ms; slowest was ${slowest} ms).`,
      hint: "A one-off spike after quiet time is normal (the database wakes up). If it stays slow, check the Neon dashboard.",
      link: NEON,
    });
  if (diag.dbOk && !diag.pooled)
    problems.push({
      level: "warning",
      title: "The database link is not the pooled one",
      detail: "The app uses a direct connection, which can run out of connections when many people are online.",
      hint: "Use the “pooled” connection string for DATABASE_URL in Vercel.",
      link: VERCEL_ENV,
    });
  const missing = diag.env.filter((e) => e.required && !e.set);
  if (missing.length)
    problems.push({
      level: "critical",
      title: `Required setting missing: ${missing.map((m) => m.title).join(", ")}`,
      detail: missing.map((m) => m.ifMissing).join(" "),
      hint: "Add it in Vercel → Settings → Environment Variables, then redeploy.",
      link: VERCEL_ENV,
    });
  if (!tracking)
    problems.push({
      level: "info",
      title: "Error tracking is switched off",
      detail: "Until it is on, crashes and failed sign-ins are not recorded here, so a problem could go unnoticed.",
      hint: "Open the “Crashes & sign-ins” tab below and press “Turn on error tracking”. It is one safe, additive step.",
      link: { label: "Open Crashes & sign-ins", href: "#errors" },
    });
  if (events.errors24 > 0)
    problems.push({
      level: events.errors24 >= 10 ? "critical" : "warning",
      title: `${events.errors24} server error${events.errors24 > 1 ? "s" : ""} in the last 24 hours`,
      detail: events.groupedErrors[0]
        ? `Most recent: “${events.groupedErrors[0].message.slice(0, 120)}” on ${events.groupedErrors[0].path ?? "an unknown page"}.`
        : "See the error table below.",
      hint: "Open the “Crashes & sign-ins” tab below. A page that crashes for staff usually shows up here first.",
      link: { label: "Open Crashes & sign-ins", href: "#errors" },
    });
  if (events.failed24 >= 10)
    problems.push({
      level: "warning",
      title: `${events.failed24} failed sign-ins in 24 hours`,
      detail: "That is more than normal typing mistakes and may be someone guessing passwords.",
      hint: "Check the failed sign-ins in the “Crashes & sign-ins” tab below. If it looks like an attack, suspend the targeted account from Access.",
      link: { label: "Open Crashes & sign-ins", href: "#errors" },
    });
  if (diag.failedDevLogins24h > 0)
    problems.push({
      level: "info",
      title: `${diag.failedDevLogins24h} failed Developer sign-in${diag.failedDevLogins24h > 1 ? "s" : ""} in 24 hours`,
      detail: "Wrong-password tries on your own account. After 5 wrong tries from one place it locks for 15 minutes.",
      hint: "If these were not you, change your password.",
    });
  const nw = negWarehouse ?? 0;
  const nr = negRep ?? 0;
  const op = overpaid ?? 0;
  if (nw + nr > 0)
    problems.push({
      level: "critical",
      title: "Stock numbers do not add up",
      detail: `${nw} warehouse and ${nr} sales-rep stock line${nw + nr > 1 ? "s" : ""} have negative or impossible quantities.`,
      hint: "Open Business → stock to find them. Do not edit by hand; tell me and we fix the cause.",
      link: { label: "Open Business", href: "/developer/records" },
    });
  if (op > 0)
    problems.push({
      level: "critical",
      title: "Some sales show more paid than the total",
      detail: `${op} sale${op > 1 ? "s have" : " has"} a paid amount larger than the sale total (or below zero).`,
      hint: "Open Business → sales to find them. Money records must not be edited by hand.",
      link: { label: "Open Business", href: "/developer/records" },
    });
  if (dbSize > 400 * 1024 * 1024)
    problems.push({
      level: "warning",
      title: "The database is getting large",
      detail: `Total size is ${(dbSize / 1048576).toFixed(0)} MB.`,
      hint: "Link the public Vercel Blob store (ora-files, Storage tab) so receipts and proofs stop living inside the database.",
      link: VERCEL_ENV,
    });

  // Owner reports: did the daily one run, and did it reach WhatsApp?
  const dailyOn = reportSettings?.dailyEnabled !== false;
  const lastDailyAge = lastDaily ? Date.now() - lastDaily.createdAt.getTime() : Infinity;
  if (dailyOn && lastDailyAge > 36 * 3_600_000)
    problems.push({
      level: "warning",
      title: "The daily owner report did not run",
      detail: lastDaily ? `The last daily report was built ${agoText(lastDailyAge)}.` : "No daily report has ever been built.",
      hint: "The report is started by a scheduled call to /api/cron/daily-report. Check that your scheduler still calls it with the right secret.",
    });
  const waFailing = ops.wa24.failed > 0; // one WhatsApp outage should raise one warning, not three
  if (lastReport && !lastReport.whatsappSent && waConfigured && !waFailing)
    problems.push({
      level: "warning",
      title: "The latest owner report was not sent on WhatsApp",
      detail: `“${lastReport.title}” was built but did not reach WhatsApp.`,
      hint: "In the owner's Reports page press “Send test WhatsApp”. If it fails, the CallMeBot key may need to be activated again.",
    });
  for (const j of jobs) {
    if (j.state === "failed" && !(waFailing && j.last?.note?.startsWith("Ran, but WhatsApp")))
      problems.push({
        level: "warning",
        title: `${j.title} failed on its last run`,
        detail: j.last?.note ?? "It ran but did not finish well.",
        hint: "Open “Messages & reports” below to see when it last went well. If it keeps failing, look at the Vercel logs for that job.",
        link: { label: "Open Messages & reports", href: "#messages" },
      });
    else if (j.state === "late" && !(j.key === "daily-report" && problems.some((p) => p.title === "The daily owner report did not run")))
      problems.push({
        level: "warning",
        title: `${j.title} did not run on time`,
        detail: `Its last run was ${agoText(Date.now() - (j.last?.at.getTime() ?? Date.now()))}; it should run every day.`,
        hint: "In Vercel → Settings → Cron Jobs check that it is still scheduled, and that the CRON_SECRET setting exists.",
        link: VERCEL_ENV,
      });
  }
  if (ops.wa24.failed > 0)
    problems.push({
      level: "warning",
      title: `${ops.wa24.failed} WhatsApp message${ops.wa24.failed > 1 ? "s" : ""} failed in the last 24 hours`,
      detail: `The owner did not receive them.${jobs.some((j) => j.state === "failed" && j.last?.note?.startsWith("Ran, but WhatsApp")) ? " A scheduled report was among them." : ""}`,
      hint: "The CallMeBot key may need to be activated again, or CallMeBot may be down. “Messages & reports” below shows the reason for each one.",
      link: { label: "Open Messages & reports", href: "#messages" },
    });
  // Optional settings that are missing: not broken, but worth knowing what you lose.
  for (const e of diag.env.filter((x) => !x.required && !x.set))
    problems.push({
      level: "info",
      title: `${e.title} is not set`,
      detail: e.ifMissing,
      hint: "Add it in Vercel → Settings → Environment Variables, then redeploy.",
      link: VERCEL_ENV,
    });

  if (negWarehouse === null || negRep === null || overpaid === null) incomplete.push("data checks");
  if (incomplete.length)
    problems.push({
      level: "info",
      title: "Some numbers could not be read just now",
      detail: `Could not load: ${incomplete.join(", ")}. This is usually a short database hiccup.`,
      hint: "Refresh the page in a minute. If it keeps happening, check the database in the Neon dashboard.",
    });

  // ── Every check that was made, passing or not (the "what was checked" list). ──
  type CheckStatus = "ok" | "look" | "fix" | "unknown";
  const systemChecks: { label: string; status: CheckStatus; detail: string }[] = [];
  const chk = (label: string, status: CheckStatus, detail: string) => systemChecks.push({ label, status, detail });
  const dbDown = !diag.dbOk || failedProbes.length === probes.length;
  chk(
    "The database can be reached",
    dbDown ? "fix" : failedProbes.length ? "look" : "ok",
    dbDown ? "Cannot connect." : failedProbes.length ? `${failedProbes.length} of ${probes.length} timing checks failed.` : `Answers in ${diag.dbMs} ms.`,
  );
  chk("The database is fast", dbDown ? "unknown" : avgMs > 400 ? "look" : "ok", dbDown ? "Could not be timed." : `Average ${avgMs} ms (healthy is under 150 ms).`);
  chk("The database link is the pooled one", dbDown ? "unknown" : diag.pooled ? "ok" : "look", diag.pooled ? "Pooled." : "Direct link: can run out of connections.");
  chk(
    "Required settings are in place",
    missing.length ? "fix" : "ok",
    missing.length ? `Missing: ${missing.map((x) => x.title).join(", ")}.` : "All required settings are set.",
  );
  const storageSet = diag.env.find((e) => e.name === "ORA_FILES_READ_WRITE_TOKEN")?.set ?? false;
  chk("File storage is linked", storageSet ? "ok" : "look", storageSet ? "Receipts and reports go to cloud storage." : "Files are kept inside the database.");
  chk("WhatsApp is set up", waConfigured ? "ok" : "look", waConfigured ? "Key and number are set." : "No WhatsApp alerts or reports are sent.");
  chk("Error tracking is on", tracking ? "ok" : "look", tracking ? "Crashes and failed sign-ins are recorded." : "Crashes are not recorded.");
  chk(
    "No crashes in the last 24 hours",
    !tracking ? "unknown" : events.errors24 === 0 ? "ok" : events.errors24 >= 10 ? "fix" : "look",
    !tracking ? "Not recorded." : events.errors24 === 0 ? "Nothing broke." : `${events.errors24} crash${events.errors24 > 1 ? "es" : ""}.`,
  );
  chk(
    "Failed sign-ins are normal",
    !tracking ? "unknown" : events.failed24 < 10 ? "ok" : "look",
    !tracking ? "Not recorded." : `${events.failed24} in 24 hours.`,
  );
  const dataChecks: [string, number | null][] = [
    ["Warehouse stock is never negative or over-reserved", negWarehouse],
    ["Sales-rep stock is never negative", negRep],
    ["No sale shows more paid than its total", overpaid],
  ];
  for (const [label, bad] of dataChecks)
    chk(label, bad === null ? "unknown" : bad > 0 ? "fix" : "ok", bad === null ? "Could not be checked just now." : bad > 0 ? `${bad} found.` : "No problems found.");
  chk(
    "The daily owner report was built",
    !dailyOn ? "ok" : lastDailyAge > 36 * 3_600_000 ? "look" : "ok",
    !dailyOn ? "Switched off in the report settings." : lastDaily ? `Last built ${agoText(lastDailyAge)}.` : "No report has been built yet.",
  );
  chk(
    "The latest owner report reached WhatsApp",
    !lastReport ? "unknown" : waConfigured && !lastReport.whatsappSent ? "look" : "ok",
    !lastReport ? "No report yet." : waConfigured && !lastReport.whatsappSent ? "Built but not sent." : "Sent.",
  );
  for (const j of jobs)
    chk(
      `${j.title} runs on time`,
      j.state === "none" ? "unknown" : j.state === "ok" ? "ok" : "look",
      j.state === "none"
        ? "No run recorded yet."
        : j.state === "failed"
          ? "Failed on its last run."
          : j.state === "late"
            ? "Its last run is more than a day and a half old."
            : "Ran on schedule.",
    );
  const waAll = ops.wa24.sent + ops.wa24.failed;
  chk(
    "WhatsApp messages arrived (24 hours)",
    !tracking || waAll === 0 ? "unknown" : ops.wa24.failed > 0 ? "look" : "ok",
    !tracking ? "Not recorded." : waAll === 0 ? "No message recorded in 24 hours." : `${ops.wa24.sent} sent, ${ops.wa24.failed} failed.`,
  );
  chk(
    "The database size is healthy",
    dbSize <= 0 ? "unknown" : dbSize > 400 * 1024 * 1024 ? "look" : "ok",
    dbSize <= 0 ? "Could not be read just now." : `${(dbSize / 1048576).toFixed(0)} MB.`,
  );

  const dbHost = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? "").hostname;
    } catch {
      return "";
    }
  })();
  const deployment = {
    build: diag.build,
    node: diag.node,
    env: process.env.VERCEL_ENV ?? diag.nodeEnv ?? "unknown",
    region: process.env.VERCEL_REGION ?? null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    message: process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0].slice(0, 120) ?? null,
    dbProvider: /neon\.tech$/.test(dbHost) ? "Neon" : dbHost ? "PostgreSQL" : null,
    dbRegion: dbHost.match(/\.([a-z]{2}-[a-z]+-\d)\./)?.[1] ?? null,
    pooled: diag.pooled,
  };

  const score = Math.max(
    0,
    100 -
      problems.filter((p) => p.level === "critical").length * 35 -
      problems.filter((p) => p.level === "warning").length * 12 -
      problems.filter((p) => p.level === "info").length * 3,
  );

  return {
    diag,
    days,
    probes,
    avgMs,
    loginSeries,
    activitySeries,
    errorSeries,
    hourSeries,
    topActors,
    modules,
    recentLogins: recentLogins.map((l) => ({ ...l, agent: describeAgent(l.userAgent) })),
    signedIn24,
    signedIn7,
    dbSize,
    tables,
    inactive,
    neverSignedIn,
    suspended,
    checks: [
      { label: "Warehouse stock is never negative or over-reserved", bad: negWarehouse },
      { label: "Sales-rep stock is never negative", bad: negRep },
      { label: "No sale shows more paid than its total", bad: overpaid },
    ],
    tracking,
    incomplete,
    growth,
    events,
    failedByIp: ops.failedByIp,
    ownerName,
    messages: {
      configured: waConfigured,
      disabled: process.env.NOTIFICATIONS_DISABLED === "1",
      wa24: ops.wa24,
      wa7Failed: ops.wa7Failed,
      since: ops.waSince,
      series: waSeries,
      trouble: ops.waTrouble,
      jobs,
      reportDays,
      dailyHour: DAILY_REPORT_HOUR_EAT,
      lastMonthly,
    },
    systemChecks,
    deployment,
    problems,
    score,
  };
}
