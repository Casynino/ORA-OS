import { prisma } from "@/lib/db";

// ─────────────────────────────────────────────────────────────────────────────
//  Field-sales read models — shared by the rep portal and admin control pages.
// ─────────────────────────────────────────────────────────────────────────────

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // Monday start
  x.setDate(x.getDate() - dow);
  return x;
}
export function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Flip stale PENDING/PARTIAL credit to OVERDUE once the due date passes. */
export async function refreshOverdueFieldCredit() {
  await prisma.fieldSale.updateMany({
    where: {
      type: "CREDIT",
      voided: false,
      creditStatus: { in: ["PENDING", "PARTIAL"] },
      dueDate: { lt: new Date() },
    },
    data: { creditStatus: "OVERDUE" },
  });
}

/** Everything the rep's overview needs, in one round trip. */
export async function getRepOverview(repId: string) {
  await refreshOverdueFieldCredit();
  const now = new Date();
  const [today, week, month] = [startOfDay(now), startOfWeek(now), startOfMonth(now)];
  const live = { repId, voided: false } as const;

  const [
    salesToday,
    salesWeek,
    salesMonth,
    unitsMonthRows,
    creditOpen,
    collectedMonth,
    cashMonth,
    samplesMonth,
    stock,
    target,
    recentSales,
    pendingStockRequests,
  ] = await Promise.all([
    prisma.fieldSale.aggregate({ _sum: { total: true }, where: { ...live, createdAt: { gte: today } } }),
    prisma.fieldSale.aggregate({ _sum: { total: true }, where: { ...live, createdAt: { gte: week } } }),
    prisma.fieldSale.aggregate({ _sum: { total: true }, _count: true, where: { ...live, createdAt: { gte: month } } }),
    prisma.fieldSaleItem.aggregate({
      _sum: { quantity: true },
      where: { sale: { ...live, createdAt: { gte: month } } },
    }),
    prisma.fieldSale.findMany({
      where: { ...live, type: "CREDIT", creditStatus: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
      select: { total: true, amountPaid: true, creditStatus: true },
    }),
    prisma.fieldPayment.aggregate({
      _sum: { amount: true },
      where: { sale: { repId, voided: false }, createdAt: { gte: month } },
    }),
    prisma.fieldSale.aggregate({
      _sum: { total: true },
      where: { ...live, type: "CASH", createdAt: { gte: month } },
    }),
    prisma.sampleLog.aggregate({ _sum: { quantity: true }, where: { repId, createdAt: { gte: month } } }),
    prisma.repStock.findMany({
      where: { repId },
      include: { product: { select: { name: true, sku: true, unitLabel: true, price: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.repTarget.findUnique({
      where: { repId_year_month: { repId, year: now.getFullYear(), month: now.getMonth() + 1 } },
    }),
    prisma.fieldSale.findMany({
      where: { repId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { customer: { select: { name: true } }, items: { select: { quantity: true } } },
    }),
    prisma.repStockRequest.count({ where: { repId, status: "PENDING" } }),
  ]);

  const creditOutstanding = creditOpen.reduce((s, c) => s + (c.total - c.amountPaid), 0);
  const overdueCount = creditOpen.filter((c) => c.creditStatus === "OVERDUE").length;
  // Cash collected = cash sales + credit collections this month.
  const cashCollectedMonth = (cashMonth._sum.total ?? 0) + (collectedMonth._sum.amount ?? 0);

  return {
    salesToday: salesToday._sum.total ?? 0,
    salesWeek: salesWeek._sum.total ?? 0,
    salesMonth: salesMonth._sum.total ?? 0,
    ordersMonth: salesMonth._count,
    unitsMonth: unitsMonthRows._sum.quantity ?? 0,
    creditOutstanding,
    overdueCount,
    cashCollectedMonth,
    creditCollectedMonth: collectedMonth._sum.amount ?? 0,
    samplesMonth: samplesMonth._sum.quantity ?? 0,
    stock,
    stockInHand: stock.reduce((s, r) => s + r.sellableQty, 0),
    samplesInHand: stock.reduce((s, r) => s + r.sampleQty, 0),
    target,
    recentSales,
    pendingStockRequests,
  };
}

export type RepPerformanceRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  region: string | null;
  status: string;
  salesMonth: number;
  unitsMonth: number;
  creditOutstanding: number;
  overdue: number;
  samplesMonth: number;
  stockInHand: number;
  samplesInHand: number;
  salesTarget: number;
  reportsMonth: number;
  lastReportAt: Date | null;
};

/** Admin: one row per rep, ranked by this month's sales. */
export async function getRepsPerformance(): Promise<RepPerformanceRow[]> {
  await refreshOverdueFieldCredit();
  const now = new Date();
  const month = startOfMonth(now);

  const reps = await prisma.user.findMany({
    where: { role: "SALES_REP" },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, phone: true, region: true, status: true },
  });
  if (reps.length === 0) return [];
  const ids = reps.map((r) => r.id);

  const [sales, units, credit, samples, stock, targets, reports] = await Promise.all([
    prisma.fieldSale.groupBy({
      by: ["repId"],
      _sum: { total: true },
      where: { repId: { in: ids }, voided: false, createdAt: { gte: month } },
    }),
    prisma.fieldSaleItem.groupBy({
      by: ["saleId"],
      _sum: { quantity: true },
      where: { sale: { repId: { in: ids }, voided: false, createdAt: { gte: month } } },
    }).then(async (rows) => {
      // saleId → repId mapping for unit sums
      const saleIds = rows.map((r) => r.saleId);
      const map = new Map<string, number>();
      if (saleIds.length) {
        const salesRows = await prisma.fieldSale.findMany({
          where: { id: { in: saleIds } },
          select: { id: true, repId: true },
        });
        const repOf = new Map(salesRows.map((s) => [s.id, s.repId]));
        for (const r of rows) {
          const rep = repOf.get(r.saleId);
          if (rep) map.set(rep, (map.get(rep) ?? 0) + (r._sum.quantity ?? 0));
        }
      }
      return map;
    }),
    prisma.fieldSale.findMany({
      where: {
        repId: { in: ids },
        voided: false,
        type: "CREDIT",
        creditStatus: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
      },
      select: { repId: true, total: true, amountPaid: true, creditStatus: true },
    }),
    prisma.sampleLog.groupBy({
      by: ["repId"],
      _sum: { quantity: true },
      where: { repId: { in: ids }, createdAt: { gte: month } },
    }),
    prisma.repStock.groupBy({
      by: ["repId"],
      _sum: { sellableQty: true, sampleQty: true },
      where: { repId: { in: ids } },
    }),
    prisma.repTarget.findMany({
      where: { repId: { in: ids }, year: now.getFullYear(), month: now.getMonth() + 1 },
    }),
    prisma.fieldReport.groupBy({
      by: ["repId"],
      _count: true,
      _max: { reportDate: true },
      where: { repId: { in: ids }, reportDate: { gte: month } },
    }),
  ]);

  const salesMap = new Map(sales.map((s) => [s.repId, s._sum.total ?? 0]));
  const samplesMap = new Map(samples.map((s) => [s.repId, s._sum.quantity ?? 0]));
  const stockMap = new Map(
    stock.map((s) => [s.repId, { sell: s._sum.sellableQty ?? 0, sample: s._sum.sampleQty ?? 0 }]),
  );
  const targetMap = new Map(targets.map((t) => [t.repId, t.salesTarget]));
  const reportMap = new Map(reports.map((r) => [r.repId, { n: r._count, last: r._max.reportDate }]));
  const creditMap = new Map<string, { out: number; overdue: number }>();
  for (const c of credit) {
    const cur = creditMap.get(c.repId) ?? { out: 0, overdue: 0 };
    cur.out += c.total - c.amountPaid;
    if (c.creditStatus === "OVERDUE") cur.overdue++;
    creditMap.set(c.repId, cur);
  }

  return reps
    .map((r) => ({
      ...r,
      status: r.status as string,
      salesMonth: salesMap.get(r.id) ?? 0,
      unitsMonth: units.get(r.id) ?? 0,
      creditOutstanding: creditMap.get(r.id)?.out ?? 0,
      overdue: creditMap.get(r.id)?.overdue ?? 0,
      samplesMonth: samplesMap.get(r.id) ?? 0,
      stockInHand: stockMap.get(r.id)?.sell ?? 0,
      samplesInHand: stockMap.get(r.id)?.sample ?? 0,
      salesTarget: targetMap.get(r.id) ?? 0,
      reportsMonth: reportMap.get(r.id)?.n ?? 0,
      lastReportAt: reportMap.get(r.id)?.last ?? null,
    }))
    .sort((a, b) => b.salesMonth - a.salesMonth);
}
