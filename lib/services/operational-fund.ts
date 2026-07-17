import { prisma } from "@/lib/db";
import type { ExpenseCategory } from "@prisma/client";

/**
 * The Operational Fund — the single pool of money the CEO allocates to Finance
 * for day-to-day operations. Finance has no bank access; they only spend what's
 * been allocated here, and every use is recorded.
 *
 * Balance = Σ(approved funding requests) − Σ(operational-fund expenses).
 * Funding never creates an Expense; only actual spend does (source =
 * OPERATIONAL_FUND), so it flows into every report once, as real money-out.
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
    prisma.expense.aggregate({ _sum: { amount: true }, where: { source: "OPERATIONAL_FUND" } }),
    prisma.pettyCashRequest.count({ where: { status: "PENDING" } }),
  ]);
  const f = funded._sum.amount ?? 0;
  const s = spent._sum.amount ?? 0;
  return { funded: f, spent: s, balance: f - s, pendingCount };
}

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
  createdAt: Date;
  approvedAt: Date | null;
};

export type FundExpenseRow = {
  id: string;
  code: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  vendor: string | null;
  receiptRef: string | null;
  receiptUrl: string | null;
  expenseDate: Date;
  note: string | null;
  recordedBy: string;
};

/** Everything the Operational Fund dashboard (finance + CEO) needs, in one round. */
export async function getOperationalFund() {
  const [requests, expenses] = await Promise.all([
    prisma.pettyCashRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: { requestedBy: { select: { name: true } }, approvedBy: { select: { name: true } } },
    }),
    prisma.expense.findMany({
      where: { source: "OPERATIONAL_FUND" },
      orderBy: { expenseDate: "desc" },
      include: { recordedBy: { select: { name: true } } },
    }),
  ]);

  const funded = requests.filter((r) => r.status === "APPROVED").reduce((a, r) => a + r.amount, 0);
  const spent = expenses.reduce((a, e) => a + e.amount, 0);
  const balance = funded - spent;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const spentThisMonth = expenses
    .filter((e) => e.expenseDate >= monthStart)
    .reduce((a, e) => a + e.amount, 0);

  const pending: FundRequestRow[] = requests
    .filter((r) => r.status === "PENDING")
    .map(toRequestRow);
  const requestRows: FundRequestRow[] = requests.map(toRequestRow);
  const expenseRows: FundExpenseRow[] = expenses.map((e) => ({
    id: e.id,
    code: e.code,
    amount: e.amount,
    category: e.category,
    description: e.purpose,
    vendor: e.vendor,
    receiptRef: e.receiptRef,
    receiptUrl: e.receiptUrl,
    expenseDate: e.expenseDate,
    note: e.note,
    recordedBy: e.recordedBy.name,
  }));

  // Spending by category (for the breakdown).
  const catMap = new Map<ExpenseCategory, number>();
  for (const e of expenses) catMap.set(e.category, (catMap.get(e.category) ?? 0) + e.amount);
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
    createdAt: r.createdAt,
    approvedAt: r.approvedAt,
  };
}
