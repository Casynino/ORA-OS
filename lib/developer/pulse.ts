import "server-only";
import { prisma } from "@/lib/db";

/**
 * "Business pulse": what is really going on in the business, in numbers the Developer can
 * read at a glance — work waiting on people, daily volume, stuck alerts, growth of the data,
 * owner reports. READ-ONLY; every probe is isolated so one failing query can't blank the tab.
 */

const DAYS = 14;

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

function lastDays(n: number): string[] {
  const out: string[] = [];
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dar_es_Salaam", year: "numeric", month: "2-digit", day: "2-digit" });
  for (let i = n - 1; i >= 0; i--) out.push(fmt.format(new Date(Date.now() - i * 86_400_000)));
  return out;
}

export type Pulse = Awaited<ReturnType<typeof getPulse>>;

export async function getPulse() {
  const days = lastDays(DAYS);
  const since = new Date(Date.now() - DAYS * 86_400_000);
  const since7 = new Date(Date.now() - 7 * 86_400_000);

  const [queues, salesByDay, moneyIn, expenses, movesByDay, growth, openAlerts, reports, teamRows, teamActions] = await Promise.all([
    safe(
      () =>
        prisma.$queryRaw<{ k: string; n: number; oldest: Date | null }[]>`
          SELECT 'sales' AS k, count(*)::int AS n, min("createdAt") AS oldest FROM "FieldSale" WHERE "financeStatus" = 'PENDING' AND "voided" = false
          UNION ALL SELECT 'collections', count(*)::int, min("createdAt") FROM "FieldPayment" WHERE "financeStatus" = 'PENDING'
          UNION ALL SELECT 'orders', count(*)::int, min("createdAt") FROM "Request" WHERE "status" IN ('PENDING', 'PRICED')
          UNION ALL SELECT 'fund', count(*)::int, min("createdAt") FROM "PettyCashRequest" WHERE "status" = 'PENDING'
          UNION ALL SELECT 'expenses', count(*)::int, min("createdAt") FROM "ExpenseClaim" WHERE "status" = 'PENDING'
          UNION ALL SELECT 'partners', count(*)::int, min("createdAt") FROM "User" WHERE "status" = 'PENDING' AND "role" = 'PARTNER'`,
      [],
    ),
    safe(
      () =>
        prisma.$queryRaw<{ day: string; st: string; n: number; v: bigint }[]>`
          SELECT to_char(((s."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Dar_es_Salaam')::date, 'YYYY-MM-DD') AS day,
                 s."financeStatus"::text AS st, count(*)::int AS n, coalesce(sum(s.total), 0)::bigint AS v
          FROM "FieldSale" s WHERE s."voided" = false AND s."createdAt" >= ${since} GROUP BY 1, 2`,
      [],
    ),
    safe(
      async () =>
        Number(
          (
            await prisma.$queryRaw<{ v: bigint }[]>`
              SELECT coalesce(sum(amount), 0)::bigint AS v FROM "FieldPayment" WHERE "createdAt" >= ${since} AND "financeStatus" = 'APPROVED'`
          )[0].v,
        ),
      0,
    ),
    safe(
      async () =>
        Number(
          (await prisma.$queryRaw<{ v: bigint }[]>`SELECT coalesce(sum(amount), 0)::bigint AS v FROM "Expense" WHERE "createdAt" >= ${since}`)[0].v,
        ),
      0,
    ),
    safe(
      () =>
        prisma.$queryRaw<{ day: string; n: number }[]>`
          SELECT to_char((("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Dar_es_Salaam')::date, 'YYYY-MM-DD') AS day, count(*)::int AS n
          FROM "StockMovement" WHERE "createdAt" >= ${since} GROUP BY 1`,
      [],
    ),
    safe(
      () =>
        prisma.$queryRaw<{ label: string; total: number; recent: number }[]>`
          SELECT 'People' AS label, count(*)::int AS total, count(*) FILTER (WHERE "createdAt" >= ${since7})::int AS recent FROM "User"
          UNION ALL SELECT 'Customers', count(*)::int, count(*) FILTER (WHERE "createdAt" >= ${since7})::int FROM "FieldCustomer"
          UNION ALL SELECT 'Sales recorded', count(*)::int, count(*) FILTER (WHERE "createdAt" >= ${since7})::int FROM "FieldSale"
          UNION ALL SELECT 'Payments collected', count(*)::int, count(*) FILTER (WHERE "createdAt" >= ${since7})::int FROM "FieldPayment"
          UNION ALL SELECT 'Partner orders', count(*)::int, count(*) FILTER (WHERE "createdAt" >= ${since7})::int FROM "Request"
          UNION ALL SELECT 'Expenses', count(*)::int, count(*) FILTER (WHERE "createdAt" >= ${since7})::int FROM "Expense"
          UNION ALL SELECT 'Stock movements', count(*)::int, count(*) FILTER (WHERE "createdAt" >= ${since7})::int FROM "StockMovement"
          UNION ALL SELECT 'Activity log lines', count(*)::int, count(*) FILTER (WHERE "createdAt" >= ${since7})::int FROM "ActivityLog"
          UNION ALL SELECT 'Alerts sent', count(*)::int, count(*) FILTER (WHERE "createdAt" >= ${since7})::int FROM "Notification"
          UNION ALL SELECT 'Photos and files', count(*)::int, count(*) FILTER (WHERE "createdAt" >= ${since7})::int FROM "Attachment"`,
      [],
    ),
    safe(
      () =>
        prisma.notification.findMany({
          where: { category: "ACTION", resolvedAt: null },
          orderBy: { createdAt: "asc" },
          take: 8,
          select: { id: true, type: true, title: true, role: true, createdAt: true, user: { select: { name: true } } },
        }),
      [],
    ),
    safe(
      () => prisma.report.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, type: true, title: true, whatsappSent: true, createdAt: true } }),
      [],
    ),
    safe(
      () =>
        prisma.$queryRaw<{ role: string; accounts: number; active: number; seen7: number }[]>`
          SELECT "role"::text AS role, count(*)::int AS accounts,
                 count(*) FILTER (WHERE "status" = 'ACTIVE')::int AS active,
                 count(*) FILTER (WHERE "lastLoginAt" >= ${since7})::int AS seen7
          FROM "User" WHERE "role" <> 'DEVELOPER' GROUP BY 1`,
      [],
    ),
    safe(
      () =>
        prisma.$queryRaw<{ role: string; n: number }[]>`
          SELECT u."role"::text AS role, count(*)::int AS n
          FROM "ActivityLog" a JOIN "User" u ON u.id = a."actorId"
          WHERE a."createdAt" >= ${since7} AND u."role" <> 'DEVELOPER' AND NOT (a.action LIKE 'DEV\\_%' OR coalesce(a.meta ->> 'developer', '') = 'true')
          GROUP BY 1`,
      [],
    ),
  ]);

  const salesSeries = days.map((day) => {
    const rows = salesByDay.filter((r) => r.day === day);
    const pick = (st: string) => rows.find((r) => r.st === st)?.n ?? 0;
    return { day, APPROVED: pick("APPROVED"), PENDING: pick("PENDING"), REJECTED: pick("REJECTED") };
  });
  const salesCount = salesByDay.reduce((s, r) => s + r.n, 0);
  const salesValue = salesByDay.filter((r) => r.st !== "REJECTED").reduce((s, r) => s + Number(r.v), 0);
  const movesSeries = days.map((day) => ({ day, n: movesByDay.find((m) => m.day === day)?.n ?? 0 }));
  const movesCount = movesSeries.reduce((s, d) => s + d.n, 0);

  const ORDER = ["ADMIN", "FINANCE", "WAREHOUSE", "SALES_REP", "PARTNER"];
  const team = ORDER.map((role) => {
    const r = teamRows.find((x) => x.role === role);
    return {
      role,
      accounts: r?.accounts ?? 0,
      active: r?.active ?? 0,
      seen7: r?.seen7 ?? 0,
      actions7: teamActions.find((x) => x.role === role)?.n ?? 0,
    };
  }).filter((t) => t.accounts > 0);

  return { days, queues, salesSeries, salesCount, salesValue, moneyIn, expenses, movesSeries, movesCount, growth, openAlerts, reports, team };
}
