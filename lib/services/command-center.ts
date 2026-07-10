import { prisma } from "@/lib/db";
import { getWarehouseSummaries } from "@/lib/warehouse-data";

/**
 * CEO Command Center data layer.
 *
 * One batched pass over the database that answers, in real time: where every
 * unit is, what sold, what cash came in, what's still owed, what needs the
 * owner's attention, and how the business is trending. Everything here is
 * computed from live data — no placeholders.
 */

const ACTIVE_CREDIT = ["OUTSTANDING", "PARTIAL", "OVERDUE"] as const;
const ACTIVE_TRANSFER = ["PENDING", "APPROVED", "IN_TRANSIT"] as const;

// ORA operates in Tanzania (East Africa Time, UTC+3, no daylight saving). The
// server (Vercel) runs in UTC, so all "today / this week / this month" windows
// are computed against Tanzania-local day boundaries — not the server's UTC day.
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** A clock shifted into EAT, so getUTC* parts read as Tanzania-local parts. */
function eatParts(now: Date) {
  const eat = new Date(now.getTime() + EAT_OFFSET_MS);
  return { y: eat.getUTCFullYear(), m: eat.getUTCMonth(), d: eat.getUTCDate(), dow: eat.getUTCDay() };
}
/** UTC instant of Tanzania-local midnight for the given EAT y/m/d. */
const eatMidnightUTC = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m, d) - EAT_OFFSET_MS);

type Bucket = { key: string; label: string; value: number };

// Six monthly buckets ending at the given EAT year/month (keys in EAT months).
function monthBuckets(year: number, month: number, n = 6): Bucket[] {
  const out: Bucket[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - i, 1));
    out.push({
      key: `${d.getUTCFullYear()}-${d.getUTCMonth()}`,
      label: d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
      value: 0,
    });
  }
  return out;
}
// Bucket key for a timestamp, by its EAT month.
const mKey = (date: Date) => {
  const d = new Date(date.getTime() + EAT_OFFSET_MS);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
};

export async function getCommandCenter() {
  // ── Time boundaries (Tanzania local time, EAT) ─────────────────
  const now = new Date();
  const eat = eatParts(now);
  const startToday = eatMidnightUTC(eat.y, eat.m, eat.d);
  // Week starts Monday (EAT). dow: 0=Sun … 6=Sat → days since Monday.
  const daysSinceMonday = (eat.dow + 6) % 7;
  const startWeek = new Date(startToday.getTime() - daysSinceMonday * DAY_MS);
  const startMonth = eatMidnightUTC(eat.y, eat.m, 1);
  const sixMonthsAgo = eatMidnightUTC(eat.y, eat.m - 5, 1);

  const [
    inventoryAgg,
    creditAccounts,
    salesToday,
    salesWeek,
    salesMonth,
    salesByPartner,
    paymentsToday,
    paymentsMonth,
    cashSalesToday,
    pendingApplications,
    pendingApprovals,
    readyForFulfillment,
    inTransitOrders,
    pendingReturns,
    transfersInProgress,
    pendingCashPayments,
    pendingSettlements,
    activePartners,
    inventoryRows,
    returnsByProduct,
    requestsByProduct,
    statusGroups,
    recentActivity,
    warehouseSummaries,
    whValueRows,
    fulfilledHistory,
    paymentHistory,
    partnerHistory,
    todaysPartnerOrders,
    repStockAgg,
    pendingRepRequests,
    fieldToday,
    fieldWeek,
    fieldMonth,
    fieldCashToday,
    fieldPaymentsToday,
    fieldPaymentsMonth,
    fieldCreditAgg,
    fieldOverdueAgg,
    fieldSalesHistory,
  ] = await Promise.all([
    prisma.inventory.aggregate({
      _sum: { warehouseQty: true, assignedQty: true, distributedQty: true },
    }),
    prisma.creditAccount.findMany({
      where: { status: { in: [...ACTIVE_CREDIT] } },
      select: {
        principal: true,
        amountPaid: true,
        status: true,
        dueDate: true,
        agentId: true,
        request: { select: { items: { select: { quantity: true } } } },
      },
    }),
    prisma.request.aggregate({
      _sum: { totalAmount: true },
      _count: true,
      where: { status: "FULFILLED", fulfilledAt: { gte: startToday } },
    }),
    prisma.request.aggregate({
      _sum: { totalAmount: true },
      _count: true,
      where: { status: "FULFILLED", fulfilledAt: { gte: startWeek } },
    }),
    prisma.request.aggregate({
      _sum: { totalAmount: true },
      _count: true,
      where: { status: "FULFILLED", fulfilledAt: { gte: startMonth } },
    }),
    prisma.request.groupBy({
      by: ["requesterId"],
      _sum: { totalAmount: true },
      _count: { _all: true },
      where: { status: "FULFILLED", fulfilledAt: { gte: startMonth } },
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 1,
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { createdAt: { gte: startToday } },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { createdAt: { gte: startMonth } },
    }),
    prisma.request.aggregate({
      _sum: { totalAmount: true },
      where: {
        status: "FULFILLED",
        paymentType: "IMMEDIATE",
        fulfilledAt: { gte: startToday },
      },
    }),
    prisma.user.count({ where: { role: "PARTNER", status: "PENDING" } }),
    prisma.request.count({ where: { status: { in: ["PENDING", "PRICED"] } } }),
    prisma.request.count({ where: { status: "APPROVED" } }),
    prisma.request.count({ where: { status: "IN_TRANSIT" } }),
    prisma.returnRequest.count({ where: { status: "PENDING" } }),
    prisma.warehouseTransfer.count({
      where: { status: { in: [...ACTIVE_TRANSFER] } },
    }),
    prisma.request.count({
      where: { status: "APPROVED", paymentType: "IMMEDIATE", paymentStatus: "UNPAID" },
    }),
    prisma.settlementRequest.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { role: "PARTNER", status: "ACTIVE" } }),
    prisma.inventory.findMany({
      include: { product: { select: { name: true, sku: true } } },
    }),
    prisma.returnRequest.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 1,
    }),
    prisma.requestItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 1,
    }),
    prisma.request.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.activityLog.findMany({ take: 9, orderBy: { createdAt: "desc" } }),
    getWarehouseSummaries(),
    prisma.warehouseStock.findMany({
      select: {
        warehouseId: true,
        onHand: true,
        product: { select: { price: true } },
      },
    }),
    prisma.request.findMany({
      where: { status: "FULFILLED", fulfilledAt: { gte: sixMonthsAgo } },
      select: { fulfilledAt: true, totalAmount: true },
    }),
    prisma.payment.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true, amount: true },
    }),
    prisma.user.findMany({
      where: { role: "PARTNER" },
      select: { createdAt: true },
    }),
    prisma.request.findMany({
      where: { fulfilledAt: { gte: startToday }, status: "FULFILLED" },
      select: {
        code: true,
        totalAmount: true,
        requester: { select: { name: true, organization: true } },
      },
      orderBy: { fulfilledAt: "desc" },
      take: 6,
    }),
    // Stock physically in sales reps' hands (their own field inventory).
    prisma.repStock.aggregate({ _sum: { sellableQty: true, sampleQty: true } }),
    prisma.repStockRequest.count({ where: { status: "PENDING" } }),
    // ── Field sales (sales reps) — cash + credit, live on the same dashboard ──
    prisma.fieldSale.aggregate({
      _sum: { total: true },
      _count: true,
      where: { voided: false, createdAt: { gte: startToday } },
    }),
    prisma.fieldSale.aggregate({
      _sum: { total: true },
      _count: true,
      where: { voided: false, createdAt: { gte: startWeek } },
    }),
    prisma.fieldSale.aggregate({
      _sum: { total: true },
      _count: true,
      where: { voided: false, createdAt: { gte: startMonth } },
    }),
    prisma.fieldSale.aggregate({
      _sum: { total: true },
      where: { voided: false, type: "CASH", createdAt: { gte: startToday } },
    }),
    prisma.fieldPayment.aggregate({
      _sum: { amount: true },
      where: { createdAt: { gte: startToday } },
    }),
    prisma.fieldPayment.aggregate({
      _sum: { amount: true },
      where: { createdAt: { gte: startMonth } },
    }),
    prisma.fieldSale.aggregate({
      _sum: { total: true, amountPaid: true },
      where: { voided: false, type: "CREDIT" },
    }),
    prisma.fieldSale.aggregate({
      _sum: { total: true, amountPaid: true },
      where: { voided: false, type: "CREDIT", creditStatus: "OVERDUE" },
    }),
    prisma.fieldSale.findMany({
      where: { voided: false, createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true, total: true },
    }),
  ]);

  // Cash orders awaiting the admin's payment confirmation (handled inside the
  // order). Credit repayments are confirmed on the Settlements page.
  const pendingPayments = pendingCashPayments;

  // ── Inventory location ─────────────────────────────────────────
  // "Assigned" holds BOTH stock committed to partner orders and stock issued
  // to sales reps — reps' live in-hand total separates the two so the answer
  // to "where is every unit?" is always Warehouse / Partner / Rep / Credit.
  const warehouseUnits = inventoryAgg._sum.warehouseQty ?? 0;
  const assignedUnits = inventoryAgg._sum.assignedQty ?? 0;
  const distributedUnits = inventoryAgg._sum.distributedQty ?? 0;
  const repUnits =
    (repStockAgg._sum.sellableQty ?? 0) + (repStockAgg._sum.sampleQty ?? 0);
  const partnerCommittedUnits = Math.max(0, assignedUnits - repUnits);
  const creditUnits = creditAccounts.reduce(
    (s, c) => s + c.request.items.reduce((t, i) => t + i.quantity, 0),
    0,
  );
  const totalInventory = warehouseUnits + assignedUnits;

  // Per-warehouse on-hand for the distribution view. Only buckets that are
  // part of "total inventory" belong in the bar — credit units are already
  // DELIVERED to partners (they're money owed, not stock ORA still holds),
  // so they'd double-count against the total if mixed in here.
  const distribution = [
    ...warehouseSummaries
      .map((w) => ({ label: w.name, units: w.onHand, kind: "warehouse" as const }))
      .filter((d) => d.units > 0),
    { label: "With sales reps", units: repUnits, kind: "rep" as const },
    { label: "With partners", units: partnerCommittedUnits, kind: "partner" as const },
  ];

  // ── Credit & finance ───────────────────────────────────────────
  let outstandingCredit = 0;
  let overdueCredit = 0;
  let overdueCount = 0;
  for (const c of creditAccounts) {
    const bal = Math.max(0, c.principal - c.amountPaid);
    outstandingCredit += bal;
    const overdue =
      c.status === "OVERDUE" || (c.dueDate ? c.dueDate < now : false);
    if (overdue && bal > 0) {
      overdueCredit += bal;
      overdueCount += 1;
    }
  }
  // Field credit (rep customers' pay-later balances) — separate from partners.
  const fieldOutstanding = Math.max(
    0,
    (fieldCreditAgg._sum.total ?? 0) - (fieldCreditAgg._sum.amountPaid ?? 0),
  );
  const fieldOverdue = Math.max(
    0,
    (fieldOverdueAgg._sum.total ?? 0) - (fieldOverdueAgg._sum.amountPaid ?? 0),
  );

  // Collections & cash include the field team: rep cash sales land as cash the
  // moment they're recorded, and rep credit collections are repayments too.
  const collectionsMonth =
    (paymentsMonth._sum.amount ?? 0) + (fieldPaymentsMonth._sum.amount ?? 0);
  const cashToday =
    (paymentsToday._sum.amount ?? 0) +
    (cashSalesToday._sum.totalAmount ?? 0) +
    (fieldCashToday._sum.total ?? 0) +
    (fieldPaymentsToday._sum.amount ?? 0);

  // ── Sales — partner orders AND field sales, one truthful number ───────────
  const fieldRevToday = fieldToday._sum.total ?? 0;
  const fieldRevWeek = fieldWeek._sum.total ?? 0;
  const fieldRevMonth = fieldMonth._sum.total ?? 0;
  const monthRevenue = (salesMonth._sum.totalAmount ?? 0) + fieldRevMonth;
  const monthOrders = (salesMonth._count ?? 0) + (fieldMonth._count ?? 0);
  const avgOrderValue = monthOrders > 0 ? Math.round(monthRevenue / monthOrders) : 0;

  let topPartner: { name: string; org: string | null; value: number } | null =
    null;
  if (salesByPartner[0]) {
    const tp = await prisma.user.findUnique({
      where: { id: salesByPartner[0].requesterId },
      select: { name: true, organization: true },
    });
    topPartner = {
      name: tp?.name ?? "—",
      org: tp?.organization ?? null,
      value: salesByPartner[0]._sum.totalAmount ?? 0,
    };
  }

  // ── Product performance ────────────────────────────────────────
  const productById = new Map(inventoryRows.map((r) => [r.productId, r]));
  const sortedByDistributed = [...inventoryRows].sort(
    (a, b) => b.distributedQty - a.distributedQty,
  );
  const bestSeller = sortedByDistributed[0] ?? null;
  const slowMover = sortedByDistributed[sortedByDistributed.length - 1] ?? null;
  const lowStockProduct = [...inventoryRows].sort(
    (a, b) => a.warehouseQty - b.warehouseQty,
  )[0] ?? null;
  const mostReturnedRow = returnsByProduct[0]
    ? productById.get(returnsByProduct[0].productId)
    : null;
  const mostRequestedRow = requestsByProduct[0]
    ? productById.get(requestsByProduct[0].productId)
    : null;

  const productPerformance = {
    best: bestSeller && {
      name: bestSeller.product.name,
      sku: bestSeller.product.sku,
      qty: bestSeller.distributedQty,
      caption: "units distributed",
    },
    slow: slowMover && {
      name: slowMover.product.name,
      sku: slowMover.product.sku,
      qty: slowMover.distributedQty,
      caption: "units distributed",
    },
    low: lowStockProduct && {
      name: lowStockProduct.product.name,
      sku: lowStockProduct.product.sku,
      qty: lowStockProduct.warehouseQty,
      caption: "units in warehouse",
    },
    returned: mostReturnedRow && {
      name: mostReturnedRow.product.name,
      sku: mostReturnedRow.product.sku,
      qty: returnsByProduct[0]?._sum.quantity ?? 0,
      caption: "units returned",
    },
    requested: mostRequestedRow && {
      name: mostRequestedRow.product.name,
      sku: mostRequestedRow.product.sku,
      qty: requestsByProduct[0]?._sum.quantity ?? 0,
      caption: "units requested",
    },
  };

  // ── Warehouse network value ────────────────────────────────────
  const valueByWh = new Map<string, number>();
  for (const r of whValueRows) {
    valueByWh.set(
      r.warehouseId,
      (valueByWh.get(r.warehouseId) ?? 0) + r.onHand * r.product.price,
    );
  }
  const networkValue = [...valueByWh.values()].reduce((s, v) => s + v, 0);
  const networkLowStock = warehouseSummaries.reduce((s, w) => s + w.lowStock, 0);

  // ── 6-month trends ─────────────────────────────────────────────
  const salesTrend = monthBuckets(eat.y, eat.m);
  for (const r of fulfilledHistory) {
    if (!r.fulfilledAt) continue;
    const b = salesTrend.find((x) => x.key === mKey(r.fulfilledAt!));
    if (b) b.value += r.totalAmount ?? 0;
  }
  // Field sales count toward the same revenue trend.
  for (const s of fieldSalesHistory) {
    const b = salesTrend.find((x) => x.key === mKey(s.createdAt));
    if (b) b.value += s.total;
  }
  const collectionsTrend = monthBuckets(eat.y, eat.m);
  for (const p of paymentHistory) {
    const b = collectionsTrend.find((x) => x.key === mKey(p.createdAt));
    if (b) b.value += p.amount;
  }
  // Cumulative partner growth
  const partnerTrend = monthBuckets(eat.y, eat.m);
  for (const b of partnerTrend) {
    const [y, m] = b.key.split("-").map(Number);
    const end = eatMidnightUTC(y, m + 1, 1);
    b.value = partnerHistory.filter((u) => u.createdAt < end).length;
  }

  // ── Status pipeline ────────────────────────────────────────────
  const statusPipeline = statusGroups.map((g) => ({
    status: g.status,
    count: g._count._all,
  }));

  // ── Alerts ─────────────────────────────────────────────────────
  const alerts: { tone: "warning" | "info" | "danger"; text: string; href: string }[] = [];
  if (pendingApprovals > 0)
    alerts.push({ tone: "warning", text: `${pendingApprovals} order${pendingApprovals === 1 ? "" : "s"} awaiting approval`, href: "/admin/requests" });
  if (pendingRepRequests > 0)
    alerts.push({ tone: "warning", text: `${pendingRepRequests} sales-rep stock request${pendingRepRequests === 1 ? "" : "s"} awaiting you`, href: "/admin/reps" });
  if (pendingPayments > 0)
    alerts.push({ tone: "warning", text: `${pendingPayments} order payment${pendingPayments === 1 ? "" : "s"} to confirm`, href: "/admin/requests" });
  if (pendingSettlements > 0)
    alerts.push({ tone: "info", text: `${pendingSettlements} credit repayment${pendingSettlements === 1 ? "" : "s"} to confirm`, href: "/admin/credit" });
  if (pendingApplications > 0)
    alerts.push({ tone: "info", text: `${pendingApplications} new partner application${pendingApplications === 1 ? "" : "s"}`, href: "/admin/users" });
  if (overdueCount > 0)
    alerts.push({ tone: "danger", text: `${overdueCount} partner${overdueCount === 1 ? "" : "s"} overdue on credit`, href: "/admin/credit" });
  if (pendingReturns > 0)
    alerts.push({ tone: "info", text: `${pendingReturns} return${pendingReturns === 1 ? "" : "s"} awaiting inspection`, href: "/admin/returns" });
  if (networkLowStock > 0)
    alerts.push({ tone: "warning", text: `${networkLowStock} product${networkLowStock === 1 ? "" : "s"} low on stock`, href: "/admin/warehouses" });

  const todaysOrders = todaysPartnerOrders.map((r) => ({
    code: r.code,
    name: r.requester.name,
    org: r.requester.organization,
    value: r.totalAmount ?? 0,
  }));

  return {
    inventory: {
      total: totalInventory,
      warehouse: warehouseUnits,
      partner: partnerCommittedUnits,
      reps: repUnits,
      credit: creditUnits,
      distributed: distributedUnits,
      distribution,
    },
    sales: {
      today: {
        revenue: (salesToday._sum.totalAmount ?? 0) + fieldRevToday,
        orders: (salesToday._count ?? 0) + (fieldToday._count ?? 0),
        partnerOrders: salesToday._count ?? 0,
        fieldSales: fieldToday._count ?? 0,
      },
      week: {
        revenue: (salesWeek._sum.totalAmount ?? 0) + fieldRevWeek,
        orders: (salesWeek._count ?? 0) + (fieldWeek._count ?? 0),
        partnerOrders: salesWeek._count ?? 0,
        fieldSales: fieldWeek._count ?? 0,
      },
      month: {
        revenue: monthRevenue,
        orders: monthOrders,
        partnerOrders: salesMonth._count ?? 0,
        fieldSales: fieldMonth._count ?? 0,
      },
      avgOrderValue,
      topPartner,
      padsDistributed: inventoryAgg._sum.distributedQty ?? 0,
    },
    finance: {
      outstandingCredit,
      activeCreditAccounts: creditAccounts.length,
      collectionsMonth,
      overdueCredit,
      fieldOutstanding,
      fieldOverdue,
      overdueCount,
      cashToday,
    },
    operations: {
      pendingApplications,
      pendingApprovals,
      pendingRepRequests,
      pendingPayments,
      readyForFulfillment,
      inTransitOrders,
      pendingReturns,
      transfersInProgress,
      activePartners,
    },
    productPerformance,
    warehouses: warehouseSummaries.map((w) => ({
      ...w,
      value: valueByWh.get(w.id) ?? 0,
    })),
    network: { value: networkValue, lowStock: networkLowStock, transfersInProgress },
    trends: { sales: salesTrend, collections: collectionsTrend, partners: partnerTrend },
    statusPipeline,
    recentActivity,
    todaysOrders,
    alerts,
  };
}
