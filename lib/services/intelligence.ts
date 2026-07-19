import { prisma } from "@/lib/db";
import { refreshOverdueFieldCredit } from "@/lib/services/field";

/**
 * CEO business-intelligence aggregations — real, live-derived figures for the
 * command centre: what's owed and when it's due, who ORA sells to, and how the
 * numbers trend. Every value comes from actual transactions/records (no demo
 * data). ORA runs mainly on CREDIT, so cash and credit are always kept apart.
 */

// ORA operates in Tanzania (EAT, UTC+3, no DST). The server runs UTC, so month
// boundaries are computed against Tanzania-local time.
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function eatNow() {
  const eat = new Date(Date.now() + EAT_OFFSET_MS);
  return { y: eat.getUTCFullYear(), m: eat.getUTCMonth(), d: eat.getUTCDate() };
}
const eatMidnightUTC = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m, d) - EAT_OFFSET_MS);

function daysOverdue(dueDate: Date | null, now: Date): number {
  if (!dueDate) return 0;
  const diff = now.getTime() - dueDate.getTime();
  return diff > 0 ? Math.floor(diff / DAY_MS) : 0;
}

// ── Collections & credit intelligence ────────────────────────────────────────

export type CollectionRow = {
  id: string;
  customer: string;
  amount: number; // outstanding on this obligation
  dueDate: Date | null;
  daysOverdue: number;
  rep: string | null;
  lastPayment: Date | null;
  channel: "field" | "partner";
};

export type CollectionsIntelligence = {
  outstandingTotal: number;
  overdueTotal: number;
  overdueCount: number;
  dueThisWeek: number; // due in the next 7 days (not yet overdue)
  dueThisMonth: number; // due between now and month-end (incl. this week)
  activeCreditCustomers: number;
  goodPayers: number;
  atRiskCustomers: number;
  collectionRate: number; // 0–100, collected ÷ billed across all credit
  dueSoon: CollectionRow[]; // soonest-due first
  overdue: CollectionRow[]; // most-overdue first
};

export async function getCollectionsIntelligence(): Promise<CollectionsIntelligence> {
  // Flip anything past its due date to OVERDUE before we read.
  await refreshOverdueFieldCredit().catch(() => {});

  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * DAY_MS);
  const { y, m } = eatNow();
  const monthEnd = eatMidnightUTC(y, m + 1, 1); // first instant of next month (EAT)

  const [fieldOpen, partnerOpen, fieldBilled, partnerBilled] = await Promise.all([
    prisma.fieldSale.findMany({
      where: {
        type: "CREDIT",
        voided: false,
        financeStatus: "APPROVED",
        creditStatus: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
      },
      select: {
        id: true, total: true, amountPaid: true, dueDate: true, creditStatus: true,
        customerName: true,
        customer: { select: { name: true, businessName: true } },
        rep: { select: { name: true } },
        payments: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.creditAccount.findMany({
      where: { status: { in: ["OUTSTANDING", "PARTIAL", "OVERDUE"] } },
      select: {
        id: true, principal: true, amountPaid: true, dueDate: true, status: true,
        agent: { select: { name: true, organization: true } },
        payments: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    // Everything ever billed on credit ORA originated, for the collection rate.
    // Opening balances are excluded — they measure legacy migration, not ORA's
    // in-system collection performance.
    prisma.fieldSale.aggregate({
      _sum: { total: true, amountPaid: true },
      where: { type: "CREDIT", voided: false, financeStatus: "APPROVED", isOpeningBalance: false },
    }),
    prisma.creditAccount.aggregate({ _sum: { principal: true, amountPaid: true } }),
  ]);

  const rows: (CollectionRow & { overdueFlag: boolean })[] = [];

  for (const s of fieldOpen) {
    const amount = Math.max(0, s.total - s.amountPaid);
    if (amount <= 0) continue;
    const overdueFlag = s.creditStatus === "OVERDUE" || (!!s.dueDate && s.dueDate < now);
    rows.push({
      id: `fs-${s.id}`,
      customer: s.customer?.businessName || s.customer?.name || s.customerName || "Walk-in customer",
      amount,
      dueDate: s.dueDate,
      daysOverdue: overdueFlag ? daysOverdue(s.dueDate, now) : 0,
      rep: s.rep?.name ?? null,
      lastPayment: s.payments[0]?.createdAt ?? null,
      channel: "field",
      overdueFlag,
    });
  }
  for (const c of partnerOpen) {
    const amount = Math.max(0, c.principal - c.amountPaid);
    if (amount <= 0) continue;
    const overdueFlag = c.status === "OVERDUE" || (!!c.dueDate && c.dueDate < now);
    rows.push({
      id: `ca-${c.id}`,
      customer: c.agent?.organization || c.agent?.name || "Partner",
      amount,
      dueDate: c.dueDate,
      daysOverdue: overdueFlag ? daysOverdue(c.dueDate, now) : 0,
      rep: null,
      lastPayment: c.payments[0]?.createdAt ?? null,
      channel: "partner",
      overdueFlag,
    });
  }

  const outstandingTotal = rows.reduce((s, r) => s + r.amount, 0);
  const overdueRows = rows.filter((r) => r.overdueFlag);
  const overdueTotal = overdueRows.reduce((s, r) => s + r.amount, 0);
  const dueThisWeek = rows
    .filter((r) => !r.overdueFlag && r.dueDate && r.dueDate >= now && r.dueDate <= weekEnd)
    .reduce((s, r) => s + r.amount, 0);
  const dueThisMonth = rows
    .filter((r) => !r.overdueFlag && r.dueDate && r.dueDate >= now && r.dueDate < monthEnd)
    .reduce((s, r) => s + r.amount, 0);

  // Good vs at-risk by distinct customer (any overdue obligation = at risk).
  const byCustomer = new Map<string, boolean>();
  for (const r of rows) {
    byCustomer.set(r.customer, (byCustomer.get(r.customer) ?? false) || r.overdueFlag);
  }
  const activeCreditCustomers = byCustomer.size;
  let atRiskCustomers = 0;
  for (const risk of byCustomer.values()) if (risk) atRiskCustomers++;
  const goodPayers = activeCreditCustomers - atRiskCustomers;

  const billed = (fieldBilled._sum.total ?? 0) + (partnerBilled._sum.principal ?? 0);
  const collected = (fieldBilled._sum.amountPaid ?? 0) + (partnerBilled._sum.amountPaid ?? 0);
  const collectionRate = billed > 0 ? Math.round((collected / billed) * 100) : 100;

  const dueSoon = rows
    .filter((r) => !r.overdueFlag && r.dueDate && r.dueDate >= now && r.dueDate <= monthEnd)
    .sort((a, b) => (a.dueDate!.getTime() - b.dueDate!.getTime()))
    .slice(0, 8)
    .map(strip);
  const overdue = overdueRows
    .sort((a, b) => b.daysOverdue - a.daysOverdue || b.amount - a.amount)
    .slice(0, 8)
    .map(strip);

  return {
    outstandingTotal,
    overdueTotal,
    overdueCount: overdueRows.length,
    dueThisWeek,
    dueThisMonth,
    activeCreditCustomers,
    goodPayers,
    atRiskCustomers,
    collectionRate,
    dueSoon,
    overdue,
  };
}

function strip(r: CollectionRow & { overdueFlag: boolean }): CollectionRow {
  const { overdueFlag, ...rest } = r;
  void overdueFlag;
  return rest;
}

// ── Customer intelligence ────────────────────────────────────────────────────

export type CustomerTypeTally = { type: string; count: number };
export type TopCustomer = { id: string; name: string; type: string | null; revenue: number; outstanding: number };

export type CustomerIntelligence = {
  total: number;
  activeThisMonth: number; // bought this calendar month
  creditCustomers: number; // have an open credit balance
  cashCustomers: number; // transacted, no open credit
  newThisMonth: number;
  partners: number; // partner accounts (separate channel)
  byType: CustomerTypeTally[];
  topCustomers: TopCustomer[];
};

export async function getCustomerIntelligence(): Promise<CustomerIntelligence> {
  const { y, m } = eatNow();
  const monthStart = eatMidnightUTC(y, m, 1);

  const [customers, sales, openCredit, partners] = await Promise.all([
    prisma.fieldCustomer.findMany({
      select: { id: true, name: true, businessName: true, customerType: true, createdAt: true },
    }),
    // Approved, non-void sales — revenue + who's active this month. Opening
    // balances excluded: they're migrated debt, not revenue or an active buy.
    prisma.fieldSale.findMany({
      where: { voided: false, financeStatus: "APPROVED", isOpeningBalance: false, customerId: { not: null } },
      select: { customerId: true, total: true, createdAt: true },
    }),
    prisma.fieldSale.findMany({
      where: {
        type: "CREDIT", voided: false, financeStatus: "APPROVED",
        creditStatus: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
        customerId: { not: null },
      },
      select: { customerId: true, total: true, amountPaid: true },
    }),
    prisma.user.count({ where: { role: "PARTNER", status: "ACTIVE" } }),
  ]);

  const total = customers.length;
  const newThisMonth = customers.filter((c) => c.createdAt >= monthStart).length;

  // Revenue + activity by customer.
  const revenue = new Map<string, number>();
  const activeIds = new Set<string>();
  for (const s of sales) {
    if (!s.customerId) continue;
    revenue.set(s.customerId, (revenue.get(s.customerId) ?? 0) + s.total);
    if (s.createdAt >= monthStart) activeIds.add(s.customerId);
  }

  // Open credit balance by customer.
  const outstanding = new Map<string, number>();
  for (const s of openCredit) {
    if (!s.customerId) continue;
    const bal = Math.max(0, s.total - s.amountPaid);
    if (bal > 0) outstanding.set(s.customerId, (outstanding.get(s.customerId) ?? 0) + bal);
  }
  const creditCustomers = outstanding.size;
  const transacted = new Set(sales.map((s) => s.customerId).filter(Boolean) as string[]);
  const cashCustomers = [...transacted].filter((id) => !outstanding.has(id)).length;

  // By business type (mapped through the customer's type; blanks grouped).
  const typeMap = new Map<string, number>();
  for (const c of customers) {
    const t = c.customerType?.trim() || "Unspecified";
    typeMap.set(t, (typeMap.get(t) ?? 0) + 1);
  }
  const byType = [...typeMap.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  const nameById = new Map(customers.map((c) => [c.id, c.businessName || c.name]));
  const typeById = new Map(customers.map((c) => [c.id, c.customerType ?? null]));
  const topCustomers: TopCustomer[] = [...revenue.entries()]
    .map(([id, rev]) => ({
      id,
      name: nameById.get(id) ?? "Customer",
      type: typeById.get(id) ?? null,
      revenue: rev,
      outstanding: outstanding.get(id) ?? 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  return {
    total,
    activeThisMonth: activeIds.size,
    creditCustomers,
    cashCustomers,
    newThisMonth,
    partners,
    byType,
    topCustomers,
  };
}

// ── Trends (6 months, cash vs credit kept apart) ─────────────────────────────

export type TrendPoint = {
  key: string;
  label: string;
  cashRevenue: number;
  creditRevenue: number;
  totalRevenue: number;
  collections: number;
  expenses: number;
};

export async function getBusinessTrends(months = 6): Promise<TrendPoint[]> {
  const { y, m } = eatNow();
  const spanStart = eatMidnightUTC(y, m - (months - 1), 1);

  const buckets: TrendPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - i, 1));
    buckets.push({
      key: `${d.getUTCFullYear()}-${d.getUTCMonth()}`,
      label: d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
      cashRevenue: 0, creditRevenue: 0, totalRevenue: 0, collections: 0, expenses: 0,
    });
  }
  const idx = new Map(buckets.map((b, i) => [b.key, i]));
  const keyOf = (date: Date) => {
    const e = new Date(date.getTime() + EAT_OFFSET_MS);
    return `${e.getUTCFullYear()}-${e.getUTCMonth()}`;
  };
  const add = (date: Date | null, field: keyof TrendPoint, v: number) => {
    if (!date) return;
    const i = idx.get(keyOf(date));
    if (i === undefined) return;
    (buckets[i][field] as number) += v;
  };

  const [fieldSales, partnerOrders, payments, fieldPayments, expenses] = await Promise.all([
    prisma.fieldSale.findMany({
      where: { voided: false, financeStatus: "APPROVED", isOpeningBalance: false, createdAt: { gte: spanStart } },
      select: { type: true, total: true, createdAt: true },
    }),
    prisma.request.findMany({
      where: { status: "FULFILLED", fulfilledAt: { gte: spanStart } },
      select: { paymentType: true, totalAmount: true, fulfilledAt: true },
    }),
    prisma.payment.findMany({ where: { createdAt: { gte: spanStart } }, select: { amount: true, createdAt: true } }),
    prisma.fieldPayment.findMany({
      where: { financeStatus: "APPROVED", sale: { voided: false }, createdAt: { gte: spanStart } },
      select: { amount: true, createdAt: true },
    }),
    prisma.expense.findMany({ where: { expenseDate: { gte: spanStart } }, select: { amount: true, expenseDate: true } }),
  ]);

  for (const s of fieldSales) {
    add(s.createdAt, s.type === "CASH" ? "cashRevenue" : "creditRevenue", s.total);
    add(s.createdAt, "totalRevenue", s.total);
  }
  for (const o of partnerOrders) {
    const amt = o.totalAmount ?? 0;
    add(o.fulfilledAt, o.paymentType === "IMMEDIATE" ? "cashRevenue" : "creditRevenue", amt);
    add(o.fulfilledAt, "totalRevenue", amt);
  }
  for (const p of payments) add(p.createdAt, "collections", p.amount);
  for (const p of fieldPayments) add(p.createdAt, "collections", p.amount);
  for (const e of expenses) add(e.expenseDate, "expenses", e.amount);

  return buckets;
}
