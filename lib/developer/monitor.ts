import "server-only";
import { prisma } from "@/lib/db";
import { getDiagnostics } from "@/lib/developer/diagnostics";

/**
 * Everything the "System health" page shows: usage, who signs in, speed, size,
 * errors and a plain-language "problems found" list. READ-ONLY, and every probe is
 * isolated so one failing query can't blank the page.
 */

const TZ = "Africa/Dar_es_Salaam";
const DAYS = 14;

export type Level = "critical" | "warning" | "info";
export type Problem = { level: Level; title: string; detail: string; hint: string };
export type Probe = { label: string; ms: number; ok: boolean };

export type Monitor = Awaited<ReturnType<typeof getMonitor>>;

/** "2026-10-17" for the last N days in Tanzania time, oldest first. */
function lastDays(n: number): string[] {
  const out: string[] = [];
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  for (let i = n - 1; i >= 0; i--) out.push(fmt.format(new Date(Date.now() - i * 86_400_000)));
  return out;
}

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
    pendingOld,
    suspended,
    negWarehouse,
    negRep,
    overpaid,
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
          take: 12,
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
    safe(
      () => prisma.user.count({ where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - 3 * 86_400_000) } } }),
      0,
    ),
    safe(() => prisma.user.count({ where: { status: "SUSPENDED" } }), 0),
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
        prisma.$queryRaw<{ message: string; path: string | null; n: number; last: Date }[]>`
          SELECT message, path, coalesce(sum("count"), 0)::int AS n, max("createdAt") AS last
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
        groupedErrors: [] as { message: string; path: string | null; n: number; last: Date }[],
        lastError: null as Date | null,
        failed24: 0,
        recentFailed: [] as { id: string; message: string; ip: string | null; createdAt: Date; count: number }[],
      };
    }
  })();

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
    });
  else if (failedProbes.length)
    problems.push({
      level: "warning",
      title: `${failedProbes.length} database check${failedProbes.length > 1 ? "s" : ""} failed`,
      detail: failedProbes.map((p) => p.label).join(", "),
      hint: "Open Home and check the database; if it keeps happening, look at the Neon dashboard.",
    });
  if (diag.dbOk && avgMs > 400)
    problems.push({
      level: "warning",
      title: "The database is slow",
      detail: `Checks averaged ${avgMs} ms (healthy is under 150 ms; slowest was ${slowest} ms).`,
      hint: "A one-off spike after quiet time is normal (the database wakes up). If it stays slow, check the Neon dashboard.",
    });
  if (diag.dbOk && !diag.pooled)
    problems.push({
      level: "warning",
      title: "The database link is not the pooled one",
      detail: "The app uses a direct connection, which can run out of connections when many people are online.",
      hint: "Use the “pooled” connection string for DATABASE_URL in Vercel.",
    });
  const missing = diag.env.filter((e) => e.required && !e.set);
  if (missing.length)
    problems.push({
      level: "critical",
      title: `Required setting missing: ${missing.map((m) => m.title).join(", ")}`,
      detail: missing.map((m) => m.ifMissing).join(" "),
      hint: "Add it in Vercel → Settings → Environment Variables, then redeploy.",
    });
  if (!tracking)
    problems.push({
      level: "info",
      title: "Error tracking is switched off",
      detail: "Until it is on, crashes and failed sign-ins are not recorded here, so a problem could go unnoticed.",
      hint: "Press “Turn on error tracking” on this page. It is one safe, additive step.",
    });
  if (events.errors24 > 0)
    problems.push({
      level: events.errors24 >= 10 ? "critical" : "warning",
      title: `${events.errors24} server error${events.errors24 > 1 ? "s" : ""} in the last 24 hours`,
      detail: events.groupedErrors[0]
        ? `Most recent: “${events.groupedErrors[0].message.slice(0, 120)}” on ${events.groupedErrors[0].path ?? "an unknown page"}.`
        : "See the error table below.",
      hint: "Open the errors table below. A page that crashes for staff usually shows up here first.",
    });
  if (events.failed24 >= 10)
    problems.push({
      level: "warning",
      title: `${events.failed24} failed sign-ins in 24 hours`,
      detail: "That is more than normal typing mistakes and may be someone guessing passwords.",
      hint: "Check the failed sign-ins table below. If it looks like an attack, suspend the targeted account from People & access.",
    });
  if (diag.failedDevLogins24h > 0)
    problems.push({
      level: "info",
      title: `${diag.failedDevLogins24h} failed Developer sign-in${diag.failedDevLogins24h > 1 ? "s" : ""} in 24 hours`,
      detail: "Wrong-password tries on your own account. After 5 wrong tries from one place it locks for 15 minutes.",
      hint: "If these were not you, change your password.",
    });
  if (diag.stuckAlerts > 0)
    problems.push({
      level: "warning",
      title: `${diag.stuckAlerts} alert${diag.stuckAlerts > 1 ? "s" : ""} waiting for more than a day`,
      detail: "These ask someone to approve or receive something, and nobody has.",
      hint: "Ask the right person to act, or check the workflow didn't forget to clear its alert.",
    });
  const nw = negWarehouse ?? 0;
  const nr = negRep ?? 0;
  const op = overpaid ?? 0;
  if (nw + nr > 0)
    problems.push({
      level: "critical",
      title: "Stock numbers do not add up",
      detail: `${nw} warehouse and ${nr} sales-rep stock line${nw + nr > 1 ? "s" : ""} have negative or impossible quantities.`,
      hint: "Open Business records → stock to find them. Do not edit by hand; tell me and we fix the cause.",
    });
  if (op > 0)
    problems.push({
      level: "critical",
      title: "Some sales show more paid than the total",
      detail: `${op} sale${op > 1 ? "s have" : " has"} a paid amount larger than the sale total (or below zero).`,
      hint: "Open Business records → sales to find them. Money records must not be edited by hand.",
    });
  if (pendingOld > 0)
    problems.push({
      level: "info",
      title: `${pendingOld} account${pendingOld > 1 ? "s" : ""} waiting over 3 days for approval`,
      detail: "New partners cannot sign in until the owner approves them.",
      hint: "Remind the owner to approve or reject them.",
    });
  if (dbSize > 400 * 1024 * 1024)
    problems.push({
      level: "warning",
      title: "The database is getting large",
      detail: `Total size is ${(dbSize / 1048576).toFixed(0)} MB.`,
      hint: "Add file storage (BLOB_READ_WRITE_TOKEN) so receipts and proofs stop living inside the database.",
    });

  if (negWarehouse === null || negRep === null || overpaid === null) incomplete.push("data checks");
  if (incomplete.length)
    problems.push({
      level: "info",
      title: "Some numbers could not be read just now",
      detail: `Could not load: ${incomplete.join(", ")}. This is usually a short database hiccup.`,
      hint: "Refresh the page in a minute. If it keeps happening, check the database on the Home page.",
    });

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
    events,
    problems,
    score,
  };
}
