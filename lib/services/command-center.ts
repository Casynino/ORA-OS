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

type Bucket = { key: string; label: string; value: number };

function monthBuckets(n = 6): Bucket[] {
  const now = new Date();
  const out: Bucket[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleString("en-US", { month: "short" }),
      value: 0,
    });
  }
  return out;
}
const mKey = (date: Date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}`;
};

export async function getCommandCenter() {
  // ── Time boundaries (server time) ──────────────────────────────
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startWeek = new Date(startToday);
  startWeek.setDate(startWeek.getDate() - ((startWeek.getDay() + 6) % 7)); // Monday
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

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
    donationsAgg,
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
    prisma.donation.aggregate({
      _sum: { amount: true },
      where: { type: "MONEY" },
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
  ]);

  // Everything awaiting a money confirmation lives on /admin/payments.
  const pendingPayments = pendingCashPayments + pendingSettlements;

  // ── Inventory location ─────────────────────────────────────────
  const warehouseUnits = inventoryAgg._sum.warehouseQty ?? 0;
  const assignedUnits = inventoryAgg._sum.assignedQty ?? 0;
  const distributedUnits = inventoryAgg._sum.distributedQty ?? 0;
  const creditUnits = creditAccounts.reduce(
    (s, c) => s + c.request.items.reduce((t, i) => t + i.quantity, 0),
    0,
  );
  const totalInventory = warehouseUnits + assignedUnits;

  // Per-warehouse on-hand for the distribution view
  const distribution = [
    ...warehouseSummaries
      .map((w) => ({ label: w.name, units: w.onHand, kind: "warehouse" as const }))
      .filter((d) => d.units > 0),
    { label: "With partners", units: assignedUnits, kind: "partner" as const },
    { label: "On credit", units: creditUnits, kind: "credit" as const },
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
  const collectionsMonth = paymentsMonth._sum.amount ?? 0;
  const cashToday =
    (paymentsToday._sum.amount ?? 0) + (cashSalesToday._sum.totalAmount ?? 0);

  // ── Sales ──────────────────────────────────────────────────────
  const monthRevenue = salesMonth._sum.totalAmount ?? 0;
  const monthOrders = salesMonth._count ?? 0;
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
  const salesTrend = monthBuckets();
  for (const r of fulfilledHistory) {
    if (!r.fulfilledAt) continue;
    const b = salesTrend.find((x) => x.key === mKey(r.fulfilledAt!));
    if (b) b.value += r.totalAmount ?? 0;
  }
  const collectionsTrend = monthBuckets();
  for (const p of paymentHistory) {
    const b = collectionsTrend.find((x) => x.key === mKey(p.createdAt));
    if (b) b.value += p.amount;
  }
  // Cumulative partner growth
  const partnerTrend = monthBuckets();
  for (const b of partnerTrend) {
    const [y, m] = b.key.split("-").map(Number);
    const end = new Date(y, m + 1, 1);
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
  if (pendingPayments > 0)
    alerts.push({ tone: "warning", text: `${pendingPayments} payment${pendingPayments === 1 ? "" : "s"} to confirm`, href: "/admin/payments" });
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
      partner: assignedUnits,
      credit: creditUnits,
      distributed: distributedUnits,
      distribution,
    },
    sales: {
      today: { revenue: salesToday._sum.totalAmount ?? 0, orders: salesToday._count ?? 0 },
      week: { revenue: salesWeek._sum.totalAmount ?? 0, orders: salesWeek._count ?? 0 },
      month: { revenue: monthRevenue, orders: monthOrders },
      avgOrderValue,
      topPartner,
      donations: donationsAgg._sum.amount ?? 0,
    },
    finance: {
      outstandingCredit,
      activeCreditAccounts: creditAccounts.length,
      collectionsMonth,
      overdueCredit,
      overdueCount,
      cashToday,
    },
    operations: {
      pendingApplications,
      pendingApprovals,
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
