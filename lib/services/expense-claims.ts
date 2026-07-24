import { prisma } from "@/lib/db";
import { EXPENSE_LABELS } from "@/lib/expense-categories";
import type { ExpenseCategory } from "@prisma/client";

export type ExpenseClaimItemRow = {
  id: string;
  label: string; // custom name or the preset category label
  description: string;
  amount: number;
  category: ExpenseCategory;
  receiptUrl: string;
  receiptRef: string | null;
  note: string | null;
};

export type ExpenseClaimRow = {
  id: string;
  code: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  note: string | null;
  recordedBy: string;
  reviewedBy: string | null;
  reviewNote: string | null;
  account: string | null;
  total: number;
  createdAt: Date;
  reviewedAt: Date | null;
  items: ExpenseClaimItemRow[];
};

function toRow(r: {
  id: string;
  code: string;
  status: string;
  note: string | null;
  reviewNote: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  recordedBy: { name: string };
  reviewedBy: { name: string } | null;
  paymentAccount: { name: string } | null;
  items: {
    id: string;
    category: ExpenseCategory;
    customCategory: string | null;
    description: string;
    amount: number;
    receiptUrl: string;
    receiptRef: string | null;
    note: string | null;
  }[];
}): ExpenseClaimRow {
  return {
    id: r.id,
    code: r.code,
    status: r.status as ExpenseClaimRow["status"],
    note: r.note,
    recordedBy: r.recordedBy.name,
    reviewedBy: r.reviewedBy?.name ?? null,
    reviewNote: r.reviewNote,
    account: r.paymentAccount?.name ?? null,
    total: r.items.reduce((s, it) => s + it.amount, 0),
    createdAt: r.createdAt,
    reviewedAt: r.reviewedAt,
    items: r.items.map((it) => ({
      id: it.id,
      label: it.customCategory?.trim() || EXPENSE_LABELS[it.category],
      description: it.description,
      amount: it.amount,
      category: it.category,
      receiptUrl: it.receiptUrl,
      receiptRef: it.receiptRef,
      note: it.note,
    })),
  };
}

/**
 * Expense claims for the Operational Fund page — the PENDING queue (for the CEO
 * to review + allocate) and the recent submissions (for Finance to track their
 * status). Defensive: if the ExpenseClaim table doesn't exist yet (migration not
 * run), returns empty so no page breaks.
 */
export async function getExpenseClaims(): Promise<{
  pending: ExpenseClaimRow[];
  recent: ExpenseClaimRow[];
  pendingTotal: number;
}> {
  try {
    const claims = await prisma.expenseClaim.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      include: {
        recordedBy: { select: { name: true } },
        reviewedBy: { select: { name: true } },
        paymentAccount: { select: { name: true } },
        items: { orderBy: { createdAt: "asc" } },
      },
    });
    const rows = claims.map(toRow);
    const pending = rows.filter((r) => r.status === "PENDING");
    return {
      pending,
      recent: rows.slice(0, 20),
      pendingTotal: pending.reduce((a, r) => a + r.total, 0),
    };
  } catch (e) {
    // Table not migrated yet (P2021) or any other read failure — degrade to empty
    // rather than 500 the whole Operational Fund / dashboard.
    console.error("[getExpenseClaims]", e instanceof Error ? e.message : e);
    return { pending: [], recent: [], pendingTotal: 0 };
  }
}

/** Just the pending count + total, for the CEO attention centre. Defensive. */
export async function getPendingExpenseClaimStats(): Promise<{ count: number; total: number }> {
  try {
    const rows = await prisma.expenseClaim.findMany({
      where: { status: "PENDING" },
      select: { items: { select: { amount: true } } },
    });
    return {
      count: rows.length,
      total: rows.reduce((a, r) => a + r.items.reduce((s, it) => s + it.amount, 0), 0),
    };
  } catch (e) {
    console.error("[getPendingExpenseClaimStats]", e instanceof Error ? e.message : e);
    return { count: 0, total: 0 };
  }
}
