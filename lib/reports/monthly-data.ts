import { prisma } from "@/lib/db";

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

/** UTC [start,end) for the EAT calendar month containing `ref` (+ previous month start). */
export function eatMonthRange(ref: Date = new Date()) {
  const eat = new Date(ref.getTime() + EAT_OFFSET_MS);
  const y = eat.getUTCFullYear(), m = eat.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1, 0, 0, 0) - EAT_OFFSET_MS);
  const end = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0) - EAT_OFFSET_MS);
  const prevStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0) - EAT_OFFSET_MS);
  const label = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Dar_es_Salaam", month: "long", year: "numeric" }).format(ref);
  return { start, end, prevStart, label };
}

export type MonthlyReportData = {
  monthLabel: string;
  revenue: { cash: number; credit: number; partnerOrders: number; total: number; unitsSold: number };
  collections: number;
  expenses: number;
  profit: number;
  outstanding: number;
  newCustomers: number;
  inventory: { current: number; dispatched: number };
  topProducts: { name: string; units: number }[];
  topCustomers: { name: string; revenue: number }[];
  topRep: { name: string; revenue: number; sales: number } | null;
  growthPct: number | null;
  insights: string[];
};

const LIVE = { voided: false, financeStatus: { not: "REJECTED" as const }, isOpeningBalance: false };

export async function getMonthlyReportData(ref: Date = new Date()): Promise<MonthlyReportData> {
  const { start, end, prevStart, label } = eatMonthRange(ref);

  const [
    salesByType, unitsAgg, partnerAgg, collectedAgg, expensesAgg,
    outstandingRows, newCust, currentStock, dispatchedAgg,
    topProdRows, salesForCustomers, salesForReps, prevRevByType,
  ] = await Promise.all([
    prisma.fieldSale.groupBy({ by: ["type"], _sum: { total: true }, where: { ...LIVE, createdAt: { gte: start, lt: end } } }),
    prisma.fieldSaleItem.aggregate({ _sum: { quantity: true }, where: { sale: { ...LIVE, createdAt: { gte: start, lt: end } } } }),
    prisma.request.aggregate({ _sum: { totalAmount: true }, where: { status: "FULFILLED", fulfilledAt: { gte: start, lt: end } } }),
    prisma.fieldPayment.aggregate({ _sum: { amount: true }, where: { financeStatus: { not: "REJECTED" }, createdAt: { gte: start, lt: end } } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { createdAt: { gte: start, lt: end } } }),
    prisma.fieldSale.findMany({ where: { type: "CREDIT", voided: false, financeStatus: "APPROVED", creditStatus: { in: ["PENDING", "PARTIAL", "OVERDUE"] } }, select: { total: true, amountPaid: true } }),
    prisma.fieldCustomer.count({ where: { createdAt: { gte: start, lt: end } } }),
    prisma.inventory.aggregate({ _sum: { warehouseQty: true } }),
    prisma.stockMovement.aggregate({ _sum: { quantity: true }, where: { type: "DISTRIBUTED", createdAt: { gte: start, lt: end } } }),
    prisma.fieldSaleItem.groupBy({ by: ["productId"], _sum: { quantity: true }, where: { sale: { ...LIVE, createdAt: { gte: start, lt: end } } }, orderBy: { _sum: { quantity: "desc" } }, take: 5 }),
    prisma.fieldSale.findMany({ where: { ...LIVE, createdAt: { gte: start, lt: end }, customerId: { not: null } }, select: { total: true, customer: { select: { name: true, businessName: true } } } }),
    prisma.fieldSale.findMany({ where: { ...LIVE, createdAt: { gte: start, lt: end } }, select: { total: true, repId: true, rep: { select: { name: true } } } }),
    prisma.fieldSale.groupBy({ by: ["type"], _sum: { total: true }, where: { ...LIVE, createdAt: { gte: prevStart, lt: start } } }),
  ]);

  const cash = salesByType.find((s) => s.type === "CASH")?._sum.total ?? 0;
  const credit = salesByType.find((s) => s.type === "CREDIT")?._sum.total ?? 0;
  const partnerOrders = partnerAgg._sum.totalAmount ?? 0;
  const total = cash + credit + partnerOrders;
  const expenses = expensesAgg._sum.amount ?? 0;
  const collections = collectedAgg._sum.amount ?? 0;
  const profit = cash + credit + partnerOrders - expenses; // simple monthly operating view
  const outstanding = outstandingRows.reduce((a, s) => a + Math.max(0, s.total - s.amountPaid), 0);

  const prodIds = topProdRows.map((r) => r.productId);
  const prods = await prisma.product.findMany({ where: { id: { in: prodIds } }, select: { id: true, name: true } });
  const nameOf = new Map(prods.map((p) => [p.id, p.name]));
  const topProducts = topProdRows.map((r) => ({ name: nameOf.get(r.productId) ?? "Product", units: r._sum.quantity ?? 0 }));

  const custMap = new Map<string, number>();
  for (const s of salesForCustomers) {
    const nm = s.customer?.businessName ?? s.customer?.name ?? "Customer";
    custMap.set(nm, (custMap.get(nm) ?? 0) + s.total);
  }
  const topCustomers = [...custMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, revenue]) => ({ name, revenue }));

  const repMap = new Map<string, { name: string; revenue: number; sales: number }>();
  for (const s of salesForReps) {
    const r = repMap.get(s.repId) ?? { name: s.rep.name, revenue: 0, sales: 0 };
    r.revenue += s.total; r.sales += 1; repMap.set(s.repId, r);
  }
  const topRep = [...repMap.values()].sort((a, b) => b.revenue - a.revenue)[0] ?? null;

  const prevRev = (prevRevByType.find((s) => s.type === "CASH")?._sum.total ?? 0) + (prevRevByType.find((s) => s.type === "CREDIT")?._sum.total ?? 0);
  const thisFieldRev = cash + credit;
  const growthPct = prevRev > 0 ? Math.round(((thisFieldRev - prevRev) / prevRev) * 100) : null;

  const insights: string[] = [];
  if (growthPct != null) insights.push(growthPct >= 0 ? `Field revenue grew ${growthPct}% versus last month.` : `Field revenue fell ${Math.abs(growthPct)}% versus last month.`);
  if (topProducts[0]) insights.push(`${topProducts[0].name} led sales with ${topProducts[0].units} units.`);
  if (topRep) insights.push(`${topRep.name} was the top sales rep (${new Intl.NumberFormat().format(topRep.revenue)} TSh).`);
  insights.push(profit >= 0 ? `The month closed with an operating profit of TSh ${profit.toLocaleString()}.` : `The month closed at an operating loss of TSh ${Math.abs(profit).toLocaleString()}.`);
  if (outstanding > 0) insights.push(`TSh ${outstanding.toLocaleString()} in credit remains outstanding — prioritise collections.`);

  return {
    monthLabel: label,
    revenue: { cash, credit, partnerOrders, total, unitsSold: unitsAgg._sum.quantity ?? 0 },
    collections, expenses, profit, outstanding, newCustomers: newCust,
    inventory: { current: currentStock._sum.warehouseQty ?? 0, dispatched: dispatchedAgg._sum.quantity ?? 0 },
    topProducts, topCustomers, topRep, growthPct, insights,
  };
}
