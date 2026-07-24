import { prisma } from "@/lib/db";
import { EXPENSE_LABELS } from "@/lib/expense-categories";
import type { ExpenseCategory } from "@prisma/client";

/**
 * The Operational Fund — a controlled petty-cash float the CEO allocates to
 * Finance for day-to-day operations. Finance has no bank access; they only
 * spend what's been allocated, and account for every shilling.
 *
 * Accounting: when the CEO approves a funding request, the allocation is booked
 * as a Company Expense immediately (money out of the company into the fund).
 * Finance's per-item spends are ACCOUNTABILITY records (OperationalSpend) — they
 * reduce the fund balance but are NOT additional company expenses (that would
 * double-count the same money). So:
 *   Company money-out (P&L)  = the allocation expenses (source=OPERATIONAL_FUND).
 *   Fund balance             = Σ(approved funding) − Σ(operational spends).
 */

/** Fast balance for dashboards/tiles that only need the number. */
export async function getOperationalFundBalance(): Promise<{
  funded: number;
  spent: number;
  balance: number;
  pendingCount: number;
}> {
  const [funded, spent, pendingCount] = await Promise.all([
    prisma.pettyCashRequest.aggregate({ _sum: { amount: true }, where: { status: "APPROVED" } }),
    prisma.operationalSpend.aggregate({ _sum: { amount: true } }),
    prisma.pettyCashRequest.count({ where: { status: "PENDING" } }),
  ]);
  const f = funded._sum.amount ?? 0;
  const s = spent._sum.amount ?? 0;
  return { funded: f, spent: s, balance: f - s, pendingCount };
}

export type SpendSummary = {
  total: number; // every booked expense, all sources
  thisMonth: number;
  count: number;
  direct: number; // plain company expenses + approved expense claims
  fund: number; // Operational-Fund allocations
  payroll: number; // salary runs
};

/**
 * Company money actually spent so far — Σ(Expense.amount) across every source,
 * the same figure the Profit & Loss uses. This is the honest "money out" total,
 * whether it came from a fund request or a direct spend, once approved & booked.
 *
 * Broken down by origin:
 *   • direct  — plain company expenses + approved expense claims (source=DIRECT)
 *   • fund    — Operational-Fund allocations                     (source=OPERATIONAL_FUND)
 *   • payroll — paid salary runs                                 (source=PAYROLL)
 *
 * OperationalSpend rows are deliberately NOT added — they draw down a fund that
 * was already booked as an allocation expense, so counting them would double-count
 * the same shillings.
 */
export async function getSpendSummary(): Promise<SpendSummary> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [bySource, totalAgg, monthAgg, count] = await Promise.all([
    prisma.expense.groupBy({ by: ["source"], _sum: { amount: true } }),
    prisma.expense.aggregate({ _sum: { amount: true } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { expenseDate: { gte: monthStart } } }),
    prisma.expense.count(),
  ]);
  const bucket: Record<string, number> = {};
  for (const r of bySource) bucket[r.source] = r._sum.amount ?? 0;
  return {
    total: totalAgg._sum.amount ?? 0,
    thisMonth: monthAgg._sum.amount ?? 0,
    count,
    direct: bucket.DIRECT ?? 0,
    fund: bucket.OPERATIONAL_FUND ?? 0,
    payroll: bucket.PAYROLL ?? 0,
  };
}

export type FundItemRow = {
  id: string;
  label: string; // custom name or the preset category label
  description: string;
  amount: number;
};

export type FundRequestRow = {
  id: string;
  code: string;
  amount: number;
  purpose: string;
  category: ExpenseCategory;
  status: string;
  note: string | null;
  adminNote: string | null;
  requestedBy: string;
  approvedBy: string | null;
  account: string | null;
  items: FundItemRow[];
  createdAt: Date;
  approvedAt: Date | null;
};

export type FundExpenseRow = {
  id: string;
  code: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  receiptRef: string | null;
  receiptUrl: string | null;
  expenseDate: Date;
  note: string | null;
  recordedBy: string;
};

/** Everything the Operational Fund dashboard (finance + CEO) needs, in one round. */
export async function getOperationalFund() {
  const [requests, spends] = await Promise.all([
    prisma.pettyCashRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        requestedBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
        paymentAccount: { select: { name: true } },
        items: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.operationalSpend.findMany({
      orderBy: { expenseDate: "desc" },
      include: { recordedBy: { select: { name: true } } },
    }),
  ]);

  const funded = requests.filter((r) => r.status === "APPROVED").reduce((a, r) => a + r.amount, 0);
  const spent = spends.reduce((a, e) => a + e.amount, 0);
  const balance = funded - spent;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const spentThisMonth = spends
    .filter((e) => e.expenseDate >= monthStart)
    .reduce((a, e) => a + e.amount, 0);

  const pending: FundRequestRow[] = requests
    .filter((r) => r.status === "PENDING")
    .map(toRequestRow);
  // CEO-issued funds still awaiting Finance's receipt confirmation — not yet
  // counted in the balance or booked as an expense.
  const issued: FundRequestRow[] = requests
    .filter((r) => r.status === "ISSUED")
    .map(toRequestRow);
  const requestRows: FundRequestRow[] = requests.map(toRequestRow);
  const expenseRows: FundExpenseRow[] = spends.map((e) => ({
    id: e.id,
    code: e.code,
    amount: e.amount,
    category: e.category,
    description: e.description,
    receiptRef: e.receiptRef,
    receiptUrl: e.receiptUrl,
    expenseDate: e.expenseDate,
    note: e.note,
    recordedBy: e.recordedBy.name,
  }));

  // Spending by category (for the breakdown).
  const catMap = new Map<ExpenseCategory, number>();
  for (const e of spends) catMap.set(e.category, (catMap.get(e.category) ?? 0) + e.amount);
  const byCategory = [...catMap.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    balance,
    funded,
    spent,
    spentThisMonth,
    pendingTotal: pending.reduce((a, r) => a + r.amount, 0),
    pending,
    issued,
    issuedTotal: issued.reduce((a, r) => a + r.amount, 0),
    requests: requestRows,
    expenses: expenseRows,
    byCategory,
  };
}

function toRequestRow(r: {
  id: string;
  code: string;
  amount: number;
  purpose: string;
  category: ExpenseCategory;
  status: string;
  note: string | null;
  adminNote: string | null;
  createdAt: Date;
  approvedAt: Date | null;
  requestedBy: { name: string };
  approvedBy: { name: string } | null;
  paymentAccount: { name: string } | null;
  items?: { id: string; category: ExpenseCategory; customCategory: string | null; description: string; amount: number }[];
}): FundRequestRow {
  return {
    id: r.id,
    code: r.code,
    amount: r.amount,
    purpose: r.purpose,
    category: r.category,
    status: r.status,
    note: r.note,
    adminNote: r.adminNote,
    requestedBy: r.requestedBy.name,
    approvedBy: r.approvedBy?.name ?? null,
    account: r.paymentAccount?.name ?? null,
    items: (r.items ?? []).map((it) => ({
      id: it.id,
      label: it.customCategory || EXPENSE_LABELS[it.category],
      description: it.description,
      amount: it.amount,
    })),
    createdAt: r.createdAt,
    approvedAt: r.approvedAt,
  };
}
