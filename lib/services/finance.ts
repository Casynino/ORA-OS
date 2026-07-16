import { prisma } from "@/lib/db";
import type { ExpenseCategory } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
//  Finance read models.
//
//  Design: income is DERIVED from the operational tables so finance can never
//  drift from reality —
//    · Cash sales revenue ........ Request paymentStatus=PAID (cash orders +
//                                  warehouse walk-in sales)
//    · Credit collections ........ Payment (partners) + FieldPayment (field)
//    · Field cash sales .......... FieldSale type=CASH (not voided)
//    · Capital ................... CapitalEntry (kept separate from income)
//  Money out is the Expense table. Profit is accrual-based:
//    revenue (fulfilled sales) − COGS (cost of units sold) − operating
//    expenses (stock purchases excluded — that cost reaches profit via COGS).
// ─────────────────────────────────────────────────────────────────────────────

export type Period = "today" | "week" | "month" | "all";

export function periodStart(period: Period, now = new Date()): Date | null {
  if (period === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "week") return new Date(now.getTime() - 7 * 86400000);
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  return null;
}

export const EXPENSE_GROUPS: { label: string; categories: ExpenseCategory[] }[] = [
  { label: "Operational", categories: ["RENT", "UTILITIES", "STATIONERY", "OFFICE"] },
  { label: "Staff", categories: ["SALARIES", "ALLOWANCES", "TRANSPORT_REIMBURSEMENT"] },
  { label: "Logistics", categories: ["DELIVERY", "WAREHOUSE_HANDLING", "TRANSPORT_OF_GOODS"] },
  { label: "Business", categories: ["STOCK_PURCHASE", "IMPORT_COSTS", "PACKAGING", "MARKETING"] },
  { label: "Statutory & tech", categories: ["TAXES", "INTERNET", "EQUIPMENT"] },
  { label: "Other", categories: ["OTHER"] },
];

export const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  RENT: "Office rent",
  UTILITIES: "Utilities",
  STATIONERY: "Stationery",
  OFFICE: "Office expenses",
  SALARIES: "Salaries",
  ALLOWANCES: "Rep allowances",
  TRANSPORT_REIMBURSEMENT: "Transport reimbursement",
  DELIVERY: "Delivery costs",
  WAREHOUSE_HANDLING: "Warehouse handling",
  TRANSPORT_OF_GOODS: "Transport of goods",
  STOCK_PURCHASE: "Stock purchase",
  IMPORT_COSTS: "Import costs",
  PACKAGING: "Packaging",
  MARKETING: "Marketing",
  TAXES: "Taxes",
  INTERNET: "Internet",
  EQUIPMENT: "Equipment",
  OTHER: "Miscellaneous",
};

type DateFilter = { gte?: Date };
const since = (start: Date | null): DateFilter | undefined =>
  start ? { gte: start } : undefined;

/** Cash actually received in a window, split by source. */
async function cashIn(start: Date | null) {
  const [paidOrders, partnerPayments, fieldCash, fieldCollections, capital] =
    await Promise.all([
      prisma.request.aggregate({
        _sum: { totalAmount: true },
        where: {
          paymentStatus: "PAID",
          ...(start ? { fulfilledAt: { gte: start } } : {}),
        },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: start ? { createdAt: { gte: start } } : {},
      }),
      prisma.fieldSale.aggregate({
        _sum: { total: true },
        where: {
          type: "CASH",
          voided: false,
          ...(start ? { createdAt: { gte: start } } : {}),
        },
      }),
      prisma.fieldPayment.aggregate({
        _sum: { amount: true },
        where: {
          sale: { voided: false },
          ...(start ? { createdAt: { gte: start } } : {}),
        },
      }),
      prisma.capitalEntry.aggregate({
        _sum: { amount: true },
        where: start ? { entryDate: { gte: start } } : {},
      }),
    ]);

  const sales =
    (paidOrders._sum.totalAmount ?? 0) + (fieldCash._sum.total ?? 0);
  const collections =
    (partnerPayments._sum.amount ?? 0) + (fieldCollections._sum.amount ?? 0);
  const capitalIn = capital._sum.amount ?? 0;
  return {
    sales,
    collections,
    capital: capitalIn,
    // Income = money earned; capital is cash but not income.
    income: sales + collections,
    total: sales + collections + capitalIn,
  };
}

/** Accrual revenue + COGS for a window (partner/warehouse + field sales). */
async function revenueAndCogs(start: Date | null) {
  const [requests, fieldItems] = await Promise.all([
    prisma.request.findMany({
      where: {
        status: "FULFILLED",
        ...(start ? { fulfilledAt: { gte: start } } : {}),
      },
      select: {
        items: {
          select: {
            quantity: true,
            unitPrice: true,
            lineTotal: true,
            product: { select: { costPrice: true } },
          },
        },
      },
    }),
    prisma.fieldSaleItem.findMany({
      where: {
        sale: { voided: false, ...(start ? { createdAt: { gte: start } } : {}) },
      },
      select: {
        quantity: true,
        lineTotal: true,
        product: { select: { costPrice: true } },
      },
    }),
  ]);

  let revenue = 0;
  let cogs = 0;
  let units = 0;
  for (const r of requests)
    for (const it of r.items) {
      revenue += it.lineTotal ?? (it.unitPrice ?? 0) * it.quantity;
      cogs += it.product.costPrice * it.quantity;
      units += it.quantity;
    }
  for (const it of fieldItems) {
    revenue += it.lineTotal;
    cogs += it.product.costPrice * it.quantity;
    units += it.quantity;
  }
  return { revenue, cogs, units };
}

async function expensesIn(start: Date | null) {
  const rows = await prisma.expense.groupBy({
    by: ["category"],
    _sum: { amount: true },
    where: start ? { expenseDate: { gte: start } } : {},
  });
  const byCategory = new Map(rows.map((r) => [r.category, r._sum.amount ?? 0]));
  const total = rows.reduce((s, r) => s + (r._sum.amount ?? 0), 0);
  // Stock purchases are capitalised into inventory; they reach profit as COGS.
  const operating = total - (byCategory.get("STOCK_PURCHASE") ?? 0);
  return { total, operating, byCategory };
}

export async function getFinanceOverview(period: Period) {
  const start = periodStart(period);
  const today = periodStart("today")!;
  const monthStart = periodStart("month")!;

  const [
    inWindow,
    exWindow,
    rc,
    inToday,
    exToday,
    inAllTime,
    exAllTime,
    partnerCredit,
    fieldCredit,
    inventories,
    capitalAll,
    partnerCreditSalesWindow,
    fieldCreditSalesWindow,
  ] = await Promise.all([
    cashIn(start),
    expensesIn(start),
    revenueAndCogs(start),
    cashIn(today),
    expensesIn(today),
    cashIn(null),
    expensesIn(null),
    prisma.creditAccount.findMany({
      where: { status: { in: ["OUTSTANDING", "PARTIAL", "OVERDUE"] } },
      select: { principal: true, amountPaid: true, status: true },
    }),
    prisma.fieldSale.findMany({
      where: {
        type: "CREDIT",
        voided: false,
        creditStatus: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
      },
      select: { total: true, amountPaid: true, creditStatus: true },
    }),
    prisma.inventory.findMany({
      include: { product: { select: { costPrice: true, price: true } } },
    }),
    prisma.capitalEntry.findMany({ orderBy: { entryDate: "asc" } }),
    // Credit SALES made in the window (accrual — receivable, not cash yet).
    prisma.request.aggregate({
      _sum: { totalAmount: true },
      where: {
        status: "FULFILLED",
        paymentType: "CREDIT",
        ...(start ? { fulfilledAt: { gte: start } } : {}),
      },
    }),
    prisma.fieldSale.aggregate({
      _sum: { total: true },
      where: {
        type: "CREDIT",
        voided: false,
        ...(start ? { createdAt: { gte: start } } : {}),
      },
    }),
  ]);

  const grossProfit = rc.revenue - rc.cogs;
  const netProfit = grossProfit - exWindow.operating;

  // Receivables — split so finance always shows WHO owes: partners vs the
  // rep-customer book.
  const creditOutstandingPartner = partnerCredit.reduce(
    (s, c) => s + Math.max(0, c.principal - c.amountPaid),
    0,
  );
  const creditOutstandingField = fieldCredit.reduce(
    (s, c) => s + Math.max(0, c.total - c.amountPaid),
    0,
  );
  const creditOutstanding = creditOutstandingPartner + creditOutstandingField;
  const creditSalesWindow =
    (partnerCreditSalesWindow._sum.totalAmount ?? 0) +
    (fieldCreditSalesWindow._sum.total ?? 0);
  const overdueCount =
    partnerCredit.filter((c) => c.status === "OVERDUE").length +
    fieldCredit.filter((c) => c.creditStatus === "OVERDUE").length;

  // Stock anywhere in the system (warehouse + with reps/orders) is ORA's asset.
  const stockValue = inventories.reduce(
    (s, i) => s + (i.warehouseQty + i.assignedQty) * i.product.costPrice,
    0,
  );
  const stockPotentialRevenue = inventories.reduce(
    (s, i) => s + (i.warehouseQty + i.assignedQty) * i.product.price,
    0,
  );

  const cashAvailable = inAllTime.total - exAllTime.total;

  // Monthly trend — last 6 months of income vs expenses.
  const now = new Date();
  const months: { label: string; income: number; expenses: number; net: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const s = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: s.toLocaleDateString("en-GB", { month: "short" }),
      income: 0,
      expenses: 0,
      net: 0,
    });
  }
  // One query per stream over the 6-month span, bucketed in JS.
  const spanStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const [mPaidOrders, mPayments, mFieldCash, mFieldPay, mExpenses] =
    await Promise.all([
      prisma.request.findMany({
        where: { paymentStatus: "PAID", fulfilledAt: { gte: spanStart } },
        select: { totalAmount: true, fulfilledAt: true },
      }),
      prisma.payment.findMany({
        where: { createdAt: { gte: spanStart } },
        select: { amount: true, createdAt: true },
      }),
      prisma.fieldSale.findMany({
        where: { type: "CASH", voided: false, createdAt: { gte: spanStart } },
        select: { total: true, createdAt: true },
      }),
      prisma.fieldPayment.findMany({
        where: { createdAt: { gte: spanStart }, sale: { voided: false } },
        select: { amount: true, createdAt: true },
      }),
      prisma.expense.findMany({
        where: { expenseDate: { gte: spanStart } },
        select: { amount: true, expenseDate: true },
      }),
    ]);
  const bucket = (d: Date | null) => {
    if (!d) return -1;
    return (d.getFullYear() - spanStart.getFullYear()) * 12 + d.getMonth() - spanStart.getMonth();
  };
  const add = (i: number, key: "income" | "expenses", v: number) => {
    if (i >= 0 && i < months.length) months[i][key] += v;
  };
  for (const r of mPaidOrders) add(bucket(r.fulfilledAt), "income", r.totalAmount ?? 0);
  for (const r of mPayments) add(bucket(r.createdAt), "income", r.amount);
  for (const r of mFieldCash) add(bucket(r.createdAt), "income", r.total);
  for (const r of mFieldPay) add(bucket(r.createdAt), "income", r.amount);
  for (const r of mExpenses) add(bucket(r.expenseDate), "expenses", r.amount);
  for (const m of months) m.net = m.income - m.expenses;

  // Expense breakdown for the window, grouped.
  const expenseBreakdown = EXPENSE_GROUPS.map((g) => ({
    label: g.label,
    amount: g.categories.reduce((s, c) => s + (exWindow.byCategory.get(c) ?? 0), 0),
  })).filter((g) => g.amount > 0);
  const topCategories = [...exWindow.byCategory.entries()]
    .map(([c, amount]) => ({ category: c, label: EXPENSE_LABELS[c], amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);

  // Capital story
  const capitalTotal = capitalAll.reduce((s, c) => s + c.amount, 0);
  const capitalByType = new Map<string, number>();
  for (const c of capitalAll)
    capitalByType.set(c.type, (capitalByType.get(c.type) ?? 0) + c.amount);

  // Financial health score (0–100), simple and explainable.
  const monthIn = (await cashIn(monthStart)).income;
  const monthEx = (await expensesIn(monthStart)).total;
  const marginPct = rc.revenue > 0 ? (netProfit / rc.revenue) * 100 : 0;
  const marginScore = Math.max(0, Math.min(35, (marginPct / 40) * 35));
  const cashCover = monthEx > 0 ? cashAvailable / monthEx : 2;
  const cashScore = Math.max(0, Math.min(30, (cashCover / 2) * 30));
  const exposure = monthIn > 0 ? creditOutstanding / monthIn : creditOutstanding > 0 ? 1 : 0;
  const exposureScore = Math.max(0, Math.min(25, (1 - Math.min(1, exposure)) * 25));
  const overdueScore = overdueCount === 0 ? 10 : Math.max(0, 10 - overdueCount * 2);
  const healthScore = Math.round(marginScore + cashScore + exposureScore + overdueScore);

  return {
    window: {
      income: inWindow,
      creditSales: creditSalesWindow,
      expenses: exWindow.total,
      operatingExpenses: exWindow.operating,
      revenue: rc.revenue,
      cogs: rc.cogs,
      unitsSold: rc.units,
      grossProfit,
      netProfit,
      expenseBreakdown,
      topCategories,
    },
    today: {
      moneyIn: inToday.total,
      moneyOut: exToday.total,
      net: inToday.total - exToday.total,
      // Customer money only — capital injections aren't "collections".
      capitalIn: inToday.capital,
    },
    position: {
      cashAvailable,
      creditOutstanding,
      creditOutstandingPartner,
      creditOutstandingField,
      overdueCount,
      stockValue,
      stockPotentialRevenue,
      capitalTotal,
      capitalByType,
      allTimeIn: inAllTime.total,
      allTimeOut: exAllTime.total,
    },
    months,
    healthScore,
  };
}

// ── Unified ledger ──────────────────────────────────────────────────────────

export type LedgerEntry = {
  id: string;
  date: Date;
  kind:
    | "SALE"
    | "CREDIT_COLLECTED"
    | "FIELD_SALE"
    | "FIELD_COLLECTION"
    | "EXPENSE"
    | "CAPITAL";
  label: string;
  reference: string;
  category: string;
  amount: number; // signed: + in, − out
  method: string | null;
  actor: string | null;
};

export async function getLedger(period: Period, take = 120): Promise<LedgerEntry[]> {
  const start = periodStart(period);
  const dateW = since(start);

  const [orders, payments, fieldSales, fieldPayments, expenses, capital] =
    await Promise.all([
      prisma.request.findMany({
        where: { paymentStatus: "PAID", ...(dateW ? { fulfilledAt: dateW } : {}) },
        orderBy: { fulfilledAt: "desc" },
        take,
        select: {
          id: true, code: true, totalAmount: true, fulfilledAt: true, createdAt: true,
          requester: { select: { name: true, organization: true } },
        },
      }),
      prisma.payment.findMany({
        where: dateW ? { createdAt: dateW } : {},
        orderBy: { createdAt: "desc" },
        take,
        include: {
          creditAccount: {
            select: { request: { select: { code: true } }, agent: { select: { name: true } } },
          },
          recordedBy: { select: { name: true } },
        },
      }),
      prisma.fieldSale.findMany({
        where: { type: "CASH", voided: false, ...(dateW ? { createdAt: dateW } : {}) },
        orderBy: { createdAt: "desc" },
        take,
        select: {
          id: true, code: true, total: true, createdAt: true, customerName: true,
          rep: { select: { name: true } }, customer: { select: { name: true } },
        },
      }),
      prisma.fieldPayment.findMany({
        where: { sale: { voided: false }, ...(dateW ? { createdAt: dateW } : {}) },
        orderBy: { createdAt: "desc" },
        take,
        include: {
          sale: { select: { code: true, customer: { select: { name: true } } } },
          recordedBy: { select: { name: true } },
        },
      }),
      prisma.expense.findMany({
        where: dateW ? { expenseDate: dateW } : {},
        orderBy: { expenseDate: "desc" },
        take,
        include: { recordedBy: { select: { name: true } } },
      }),
      prisma.capitalEntry.findMany({
        where: dateW ? { entryDate: dateW } : {},
        orderBy: { entryDate: "desc" },
        take,
        include: { recordedBy: { select: { name: true } } },
      }),
    ]);

  const rows: LedgerEntry[] = [
    ...orders.map((o) => ({
      id: `req-${o.id}`,
      date: o.fulfilledAt ?? o.createdAt,
      kind: "SALE" as const,
      label: `Sale to ${o.requester.organization ?? o.requester.name}`,
      reference: o.code,
      category: "Sales income",
      amount: o.totalAmount ?? 0,
      method: null,
      actor: null,
    })),
    ...payments.map((p) => ({
      id: `pay-${p.id}`,
      date: p.createdAt,
      kind: "CREDIT_COLLECTED" as const,
      label: `Credit payment — ${p.creditAccount.agent.name}`,
      reference: p.creditAccount.request.code,
      category: "Credit collected",
      amount: p.amount,
      method: p.method,
      actor: p.recordedBy.name,
    })),
    ...fieldSales.map((s) => ({
      id: `fs-${s.id}`,
      date: s.createdAt,
      kind: "FIELD_SALE" as const,
      label: `Field cash sale — ${s.customer?.name ?? s.customerName ?? "walk-in"} (${s.rep.name})`,
      reference: s.code,
      category: "Sales income",
      amount: s.total,
      method: "Cash",
      actor: s.rep.name,
    })),
    ...fieldPayments.map((p) => ({
      id: `fp-${p.id}`,
      date: p.createdAt,
      kind: "FIELD_COLLECTION" as const,
      label: `Field credit collection${p.sale.customer ? ` — ${p.sale.customer.name}` : ""}`,
      reference: p.sale.code,
      category: "Credit collected",
      amount: p.amount,
      method: p.method,
      actor: p.recordedBy.name,
    })),
    ...expenses.map((e) => ({
      id: `exp-${e.id}`,
      date: e.expenseDate,
      kind: "EXPENSE" as const,
      label: e.purpose,
      reference: e.code,
      category: EXPENSE_LABELS[e.category],
      amount: -e.amount,
      method: e.paymentMethod,
      actor: e.recordedBy.name,
    })),
    ...capital.map((c) => ({
      id: `cap-${c.id}`,
      date: c.entryDate,
      kind: "CAPITAL" as const,
      label: `Capital — ${c.source}`,
      reference: c.code,
      category: c.type.replaceAll("_", " ").toLowerCase(),
      amount: c.amount,
      method: null,
      actor: c.recordedBy.name,
    })),
  ];

  return rows.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, take);
}
