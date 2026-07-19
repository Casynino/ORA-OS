import { prisma } from "@/lib/db";

// ── Tanzania-time (EAT = UTC+3) day boundaries ───────────────────────────────
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

/** The UTC [start,end) range for the EAT calendar day containing `ref`, plus a label. */
export function eatDayRange(ref: Date = new Date()) {
  const eat = new Date(ref.getTime() + EAT_OFFSET_MS);
  const y = eat.getUTCFullYear(), m = eat.getUTCMonth(), d = eat.getUTCDate();
  const start = new Date(Date.UTC(y, m, d, 0, 0, 0) - EAT_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const label = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Dar_es_Salaam", day: "numeric", month: "long", year: "numeric",
  }).format(ref);
  return { start, end, label };
}

export type TeamRow = { name: string; a: number; b: number; c: number };

export type DailyReportData = {
  dateLabel: string;
  sales: { cash: number; credit: number; partnerOrders: number; revenue: number; unitsSold: number; orderCount: number; bestSeller: string | null; bestSellerUnits: number };
  customers: { newCount: number; activeCount: number; creditCount: number; paymentsReceived: number };
  credit: { outstanding: number; collectedToday: number; overdueCount: number; dueSoonCount: number };
  inventory: { openingPieces: number; dispatchedPieces: number; returnedPieces: number; currentPieces: number; dispatchedCartons: number };
  warehouse: { dispatches: number; returns: number; transfers: number; pendingRequests: number };
  finance: { paymentsVerified: number; cashReceived: number; deposits: number; officeExpenses: number };
  team: { reps: TeamRow[]; warehouse: TeamRow[]; finance: TeamRow[] };
  insights: string[];
};

const LIVE = { voided: false, financeStatus: { not: "REJECTED" as const }, isOpeningBalance: false };

/** Aggregate a full day of business activity (defaults to today, EAT). */
export async function getDailyReportData(ref: Date = new Date()): Promise<DailyReportData> {
  const { start, end, label } = eatDayRange(ref);
  const yStart = new Date(start.getTime() - 24 * 60 * 60 * 1000); // yesterday, for insight deltas

  const [
    salesByType, itemsAgg, bestSellerRows, salesForTeam,
    newCustomers, activeCustomerIds, creditCustomers, collectedAgg,
    outstandingRows, overdueCount, dueSoonCount,
    dispatchedAgg, returnedAgg, transfersToday, pendingReqs,
    paymentsVerified, cashReceivedAgg, depositsAgg, officeExpAgg,
    partnerOrdersAgg, currentStock, yRevenueByType, yCollectedAgg,
  ] = await Promise.all([
    prisma.fieldSale.groupBy({ by: ["type"], _sum: { total: true }, _count: { _all: true }, where: { ...LIVE, createdAt: { gte: start, lt: end } } }),
    prisma.fieldSaleItem.aggregate({ _sum: { quantity: true }, where: { sale: { ...LIVE, createdAt: { gte: start, lt: end } } } }),
    prisma.fieldSaleItem.groupBy({ by: ["productId"], _sum: { quantity: true }, where: { sale: { ...LIVE, createdAt: { gte: start, lt: end } } }, orderBy: { _sum: { quantity: "desc" } }, take: 1 }),
    prisma.fieldSale.findMany({ where: { ...LIVE, createdAt: { gte: start, lt: end } }, select: { repId: true, total: true, customerId: true, rep: { select: { name: true } } } }),
    prisma.fieldCustomer.count({ where: { createdAt: { gte: start, lt: end } } }),
    prisma.fieldSale.findMany({ where: { ...LIVE, createdAt: { gte: start, lt: end }, customerId: { not: null } }, select: { customerId: true }, distinct: ["customerId"] }),
    prisma.fieldSale.findMany({ where: { type: "CREDIT", voided: false, financeStatus: "APPROVED", creditStatus: { in: ["PENDING", "PARTIAL", "OVERDUE"] } }, select: { customerId: true }, distinct: ["customerId"] }),
    prisma.fieldPayment.aggregate({ _sum: { amount: true }, where: { financeStatus: { not: "REJECTED" }, createdAt: { gte: start, lt: end } } }),
    prisma.fieldSale.findMany({ where: { type: "CREDIT", voided: false, financeStatus: "APPROVED", creditStatus: { in: ["PENDING", "PARTIAL", "OVERDUE"] } }, select: { total: true, amountPaid: true } }),
    prisma.fieldSale.count({ where: { type: "CREDIT", voided: false, financeStatus: "APPROVED", creditStatus: "OVERDUE" } }),
    prisma.fieldSale.count({ where: { type: "CREDIT", voided: false, financeStatus: "APPROVED", creditStatus: { in: ["PENDING", "PARTIAL"] }, dueDate: { gte: end, lt: new Date(end.getTime() + 3 * 24 * 60 * 60 * 1000) } } }),
    prisma.stockMovement.aggregate({ _sum: { quantity: true }, where: { type: "DISTRIBUTED", createdAt: { gte: start, lt: end } } }),
    prisma.stockMovement.aggregate({ _sum: { quantity: true }, where: { type: { in: ["RESTOCKED", "RETURNED"] }, createdAt: { gte: start, lt: end } } }),
    prisma.warehouseTransfer.count({ where: { createdAt: { gte: start, lt: end } } }),
    prisma.repStockRequest.count({ where: { status: "PENDING" } }),
    prisma.fieldPayment.findMany({ where: { financeStatus: "APPROVED", financeReviewedAt: { gte: start, lt: end } }, select: { amount: true, financeReviewedById: true, financeReviewedBy: { select: { name: true } } } }),
    prisma.fieldSale.aggregate({ _sum: { total: true }, where: { type: "CASH", voided: false, financeStatus: "APPROVED", createdAt: { gte: start, lt: end } } }),
    prisma.cashDeposit.aggregate({ _sum: { total: true }, where: { createdAt: { gte: start, lt: end } } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { createdAt: { gte: start, lt: end } } }),
    prisma.request.aggregate({ _sum: { totalAmount: true }, _count: true, where: { status: "FULFILLED", fulfilledAt: { gte: start, lt: end } } }),
    prisma.inventory.aggregate({ _sum: { warehouseQty: true } }),
    prisma.fieldSale.groupBy({ by: ["type"], _sum: { total: true }, where: { ...LIVE, createdAt: { gte: yStart, lt: start } } }),
    prisma.fieldPayment.aggregate({ _sum: { amount: true }, where: { financeStatus: { not: "REJECTED" }, createdAt: { gte: yStart, lt: start } } }),
  ]);

  const cash = salesByType.find((s) => s.type === "CASH")?._sum.total ?? 0;
  const credit = salesByType.find((s) => s.type === "CREDIT")?._sum.total ?? 0;
  const partnerOrders = partnerOrdersAgg._sum.totalAmount ?? 0;
  const revenue = cash + credit + partnerOrders;
  const orderCount = salesByType.reduce((a, s) => a + s._count._all, 0) + (partnerOrdersAgg._count ?? 0);

  let bestSeller: string | null = null, bestSellerUnits = 0;
  if (bestSellerRows[0]) {
    const prod = await prisma.product.findUnique({ where: { id: bestSellerRows[0].productId }, select: { name: true } });
    bestSeller = prod?.name ?? null;
    bestSellerUnits = bestSellerRows[0]._sum.quantity ?? 0;
  }

  const outstanding = outstandingRows.reduce((a, s) => a + Math.max(0, s.total - s.amountPaid), 0);
  const currentPieces = currentStock._sum.warehouseQty ?? 0;
  const dispatchedPieces = dispatchedAgg._sum.quantity ?? 0;
  const returnedPieces = returnedAgg._sum.quantity ?? 0;
  const openingPieces = currentPieces + dispatchedPieces - returnedPieces; // reconstruct start-of-day

  // ── Team performance ──
  const repMap = new Map<string, { name: string; sales: number; revenue: number; customers: Set<string> }>();
  for (const s of salesForTeam) {
    const r = repMap.get(s.repId) ?? { name: s.rep.name, sales: 0, revenue: 0, customers: new Set<string>() };
    r.sales += 1; r.revenue += s.total; if (s.customerId) r.customers.add(s.customerId);
    repMap.set(s.repId, r);
  }
  const reps: TeamRow[] = [...repMap.values()].sort((a, b) => b.revenue - a.revenue).map((r) => ({ name: r.name, a: r.sales, b: r.customers.size, c: r.revenue }));

  const finMap = new Map<string, { name: string; verified: number; amount: number }>();
  for (const pay of paymentsVerified) {
    if (!pay.financeReviewedById) continue;
    const f = finMap.get(pay.financeReviewedById) ?? { name: pay.financeReviewedBy?.name ?? "Finance", verified: 0, amount: 0 };
    f.verified += 1; f.amount += pay.amount; finMap.set(pay.financeReviewedById, f);
  }
  const finance: TeamRow[] = [...finMap.values()].map((f) => ({ name: f.name, a: f.verified, b: f.amount, c: 0 }));

  const dispatchMovements = await prisma.stockMovement.findMany({ where: { type: "DISTRIBUTED", createdAt: { gte: start, lt: end } }, select: { quantity: true, createdById: true, createdBy: { select: { name: true, role: true } } } });
  const whMap = new Map<string, { name: string; moves: number; qty: number }>();
  for (const m of dispatchMovements) {
    if (m.createdBy.role !== "WAREHOUSE") continue;
    const w = whMap.get(m.createdById) ?? { name: m.createdBy.name, moves: 0, qty: 0 };
    w.moves += 1; w.qty += m.quantity; whMap.set(m.createdById, w);
  }
  const warehouse: TeamRow[] = [...whMap.values()].map((w) => ({ name: w.name, a: w.moves, b: w.qty, c: 0 }));

  // ── Insights (auto-generated) ──
  const yRevenue = (yRevenueByType.find((s) => s.type === "CASH")?._sum.total ?? 0) + (yRevenueByType.find((s) => s.type === "CREDIT")?._sum.total ?? 0);
  const yCollected = yCollectedAgg._sum.amount ?? 0;
  const collectedToday = collectedAgg._sum.amount ?? 0;
  const insights: string[] = [];
  const fieldRevToday = cash + credit;
  if (yRevenue > 0) {
    const pct = Math.round(((fieldRevToday - yRevenue) / yRevenue) * 100);
    insights.push(pct >= 0 ? `Field sales revenue is up ${pct}% versus yesterday.` : `Field sales revenue is down ${Math.abs(pct)}% versus yesterday.`);
  } else if (fieldRevToday > 0) {
    insights.push("First field sales recorded today after a quiet previous day.");
  }
  if (yCollected > 0 && collectedToday > 0) {
    const pct = Math.round(((collectedToday - yCollected) / yCollected) * 100);
    insights.push(pct >= 0 ? `Credit collection improved ${pct}% versus yesterday.` : `Credit collection is ${Math.abs(pct)}% lower than yesterday.`);
  }
  if (bestSeller) insights.push(`${bestSeller} is today's best seller (${bestSellerUnits} units).`);
  if (overdueCount === 0) insights.push("No overdue credit accounts — collections are on track.");
  else insights.push(`${overdueCount} credit ${overdueCount === 1 ? "account is" : "accounts are"} overdue and need follow-up.`);
  insights.push(currentPieces > 5000 ? "Inventory remains healthy." : "Inventory is running low — plan a restock.");

  return {
    dateLabel: label,
    sales: { cash, credit, partnerOrders, revenue, unitsSold: itemsAgg._sum.quantity ?? 0, orderCount, bestSeller, bestSellerUnits },
    customers: { newCount: newCustomers, activeCount: activeCustomerIds.length, creditCount: creditCustomers.length, paymentsReceived: collectedToday },
    credit: { outstanding, collectedToday, overdueCount, dueSoonCount },
    inventory: { openingPieces, dispatchedPieces, returnedPieces, currentPieces, dispatchedCartons: Math.round(dispatchedPieces / 24) },
    warehouse: { dispatches: dispatchedPieces, returns: returnedPieces, transfers: transfersToday, pendingRequests: pendingReqs },
    finance: { paymentsVerified: paymentsVerified.length, cashReceived: cashReceivedAgg._sum.total ?? 0, deposits: depositsAgg._sum.total ?? 0, officeExpenses: officeExpAgg._sum.amount ?? 0 },
    team: { reps, warehouse, finance },
    insights,
  };
}
