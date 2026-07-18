"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { refCode } from "@/lib/utils";
import { EXPENSE_CATEGORY_VALUES, EXPENSE_LABELS } from "@/lib/expense-categories";
import type { ExpenseCategory } from "@prisma/client";
import { getBusinessCapital } from "@/lib/services/finance";
import { resolveReceivingAccount } from "@/lib/payment-methods";
import { formatCurrency } from "@/lib/utils";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

// Every shilling leaving ORA is recorded, categorised and tied to the admin
// who approved it. No expense without a record; no income without a source.
// Capital moves the same way: an investment adds to Business Capital, an owner
// withdrawal (stored NEGATIVE) subtracts — all derived, never hand-kept.

const CAPITAL_TYPES = [
  "FOUNDER_INVESTMENT", "INVESTMENT", "PROFIT_REINVESTED", "GRANT", "OTHER", "WITHDRAWAL",
] as const;

function revalidateFinance() {
  for (const p of ["/admin/finance", "/admin/finance/profit", "/admin/finance/operational-fund", "/admin/finance/capital", "/admin/finance/ledger", "/admin", "/finance", "/finance/operational-fund", "/finance/reports"])
    revalidatePath(p);
}

// One line of a (possibly multi-item) expense: its own category + amount, filed
// individually so grouped P&L stays correct per line.
const expenseItemSchema = z.object({
  category: z.enum(EXPENSE_CATEGORY_VALUES),
  customCategory: z.string().max(60).optional().or(z.literal("")),
  amount: z.number().int().positive().max(1000000000),
  // Optional — the category names the expense; a description just adds detail.
  purpose: z.string().max(200).optional().or(z.literal("")),
  // Who this line was paid to / where the money went (per line).
  vendor: z.string().max(160).optional().or(z.literal("")),
});

/** What an expense line is "for" — its own description, else the category name
 *  (custom or preset). So a line never shows blank in the ledger. */
function expensePurpose(it: { purpose?: string; customCategory?: string; category: ExpenseCategory }): string {
  return it.purpose?.trim() || it.customCategory?.trim() || EXPENSE_LABELS[it.category];
}

// The shared "paid from" envelope wrapping the lines — one account, date, vendor
// and receipt for the whole batch.
const expensesSchema = z.object({
  items: z.array(expenseItemSchema).min(1, "Add at least one expense.").max(50),
  vendor: z.string().max(160).optional().or(z.literal("")),
  paymentMethod: z.string().max(40).optional().or(z.literal("")),
  paymentAccountId: z.string().optional().or(z.literal("")), // company account paid from
  expenseDate: z.string().optional().or(z.literal("")), // ISO date
  receiptUrl: z.string().max(15000000).optional().or(z.literal("")), // data-URL image ok
  note: z.string().max(500).optional().or(z.literal("")),
});

// The single-expense shape (kept for the compat wrapper below).
const expenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORY_VALUES),
  customCategory: z.string().max(60).optional().or(z.literal("")),
  amount: z.number().int().positive().max(1000000000),
  purpose: z.string().min(3, "What was this expense for?").max(200),
  vendor: z.string().max(160).optional().or(z.literal("")),
  paymentMethod: z.string().max(40).optional().or(z.literal("")),
  paymentAccountId: z.string().optional().or(z.literal("")),
  expenseDate: z.string().optional().or(z.literal("")),
  receiptUrl: z.string().max(15000000).optional().or(z.literal("")),
  note: z.string().max(500).optional().or(z.literal("")),
});

/** Record one or more company expenses in a single action. Every line is paid
 *  from the SAME chosen account/date/receipt and becomes its own DIRECT Expense
 *  (categorised individually) — all created in ONE transaction, tied together by
 *  a shared batchCode when there's more than one line. Money-out is the Σ of the
 *  lines, reducing Business Capital + the source account exactly once each (all
 *  money-out is derived from Expense rows — no double counting). ADMIN (CEO) or
 *  FINANCE; takes effect immediately (the CEO is final authority). */
export async function recordExpenses(
  input: z.infer<typeof expensesSchema>,
): Promise<ActionResult<{ count: number; total: number }>> {
  try {
    const actor = await requireActor(["ADMIN", "FINANCE"]);
    const parsed = expensesSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid expense.");
    const d = parsed.data;
    if (d.expenseDate && Number.isNaN(new Date(d.expenseDate).getTime()))
      return fail("The expense date is invalid.");

    // Validate the source account once (rejects unknown/deactivated); null when
    // paid outside a tracked account (cheque / other).
    const account = await resolveReceivingAccount(prisma, d.paymentAccountId || null, d.paymentMethod || null);
    const expenseDate = d.expenseDate ? new Date(d.expenseDate) : new Date();
    const method = d.paymentMethod || account.method || null;
    const vendor = d.vendor?.trim() || null;
    const total = d.items.reduce((s, it) => s + it.amount, 0);
    const multi = d.items.length > 1;
    const batchCode = multi ? refCode("EXB") : null;

    // One Expense per line, all in a single atomic transaction.
    const created = await prisma.$transaction(
      d.items.map((it) =>
        prisma.expense.create({
          data: {
            code: refCode("EXP"),
            category: it.category,
            customCategory: it.customCategory?.trim() || null,
            amount: it.amount,
            purpose: expensePurpose(it),
            vendor: it.vendor?.trim() || vendor,
            paymentMethod: method,
            paymentAccountId: account.paymentAccountId,
            expenseDate,
            receiptUrl: d.receiptUrl || null,
            note: d.note || null,
            batchCode,
            recordedById: actor.id,
          },
          select: { code: true },
        }),
      ),
    );

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "EXPENSE_RECORDED",
      entity: "Expense",
      entityId: batchCode ?? created[0].code,
      summary: multi
        ? `${actor.name} recorded ${d.items.length} expenses totalling ${formatCurrency(total)}${vendor ? ` — ${vendor}` : ""}.`
        : `${actor.name} recorded expense ${created[0].code}: ${formatCurrency(total)} — ${expensePurpose(d.items[0])}.`,
    });
    revalidateFinance();
    return ok(
      { count: d.items.length, total },
      multi
        ? `${d.items.length} expenses recorded — ${formatCurrency(total)} total.`
        : `Expense ${created[0].code} recorded.`,
    );
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Record a single company expense — thin wrapper over {@link recordExpenses} so
 *  there is exactly one money-path. Kept for callers that record one line. */
export async function recordExpense(
  input: z.infer<typeof expenseSchema>,
): Promise<ActionResult> {
  const res = await recordExpenses({
    items: [
      {
        category: input.category,
        customCategory: input.customCategory,
        amount: input.amount,
        purpose: input.purpose,
      },
    ],
    vendor: input.vendor,
    paymentMethod: input.paymentMethod,
    paymentAccountId: input.paymentAccountId,
    expenseDate: input.expenseDate,
    receiptUrl: input.receiptUrl,
    note: input.note,
  });
  return res.ok ? ok(undefined, res.message) : fail(res.error);
}

export async function removeExpense(id: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN", "FINANCE"]);
    const exp = await prisma.expense.findUnique({ where: { id } });
    if (!exp) return fail("Expense not found.");
    // Payroll pay-outs and Operational Fund allocations embody a CEO approval and
    // stay in sync with their own records (PayrollRun / funding request). Deleting
    // the expense alone would desync money-out from those ledgers, so it's blocked
    // here — reverse it through its own workflow instead.
    if (exp.source !== "DIRECT") {
      return fail(
        "This expense was created by an approval workflow (payroll / operational fund) and can't be deleted here.",
      );
    }
    await prisma.expense.delete({ where: { id } });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "EXPENSE_REMOVED",
      entity: "Expense",
      entityId: exp.code,
      summary: `${actor.name} removed expense ${exp.code} (TSh ${exp.amount.toLocaleString()} — ${exp.purpose}).`,
    });
    revalidateFinance();
    return ok(undefined, `Expense ${exp.code} removed.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const capitalSchema = z.object({
  type: z.enum(CAPITAL_TYPES),
  amount: z.number().int().positive().max(10000000000),
  source: z.string().min(2, "Where did this come from / go to?").max(160),
  paymentAccountId: z.string().optional().or(z.literal("")), // account it lands in / leaves
  entryDate: z.string().optional().or(z.literal("")),
  receiptUrl: z.string().max(15000000).optional().or(z.literal("")),
  note: z.string().max(500).optional().or(z.literal("")),
});

/** Record a capital movement. Investments add to Business Capital; an owner
 *  WITHDRAWAL is stored with a NEGATIVE amount so every sum nets to what's still
 *  in the business. A withdrawal can't exceed the capital available right now. */
export async function recordCapital(
  input: z.infer<typeof capitalSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN", "FINANCE"]);
    const parsed = capitalSchema.safeParse(input);
    if (!parsed.success)
      return fail(parsed.error.issues[0]?.message ?? "Invalid capital entry.");
    const d = parsed.data;
    const isWithdrawal = d.type === "WITHDRAWAL";

    if (isWithdrawal) {
      const available = await getBusinessCapital();
      if (d.amount > available) {
        return fail(
          `Only ${formatCurrency(available)} of Business Capital is available — you can't withdraw ${formatCurrency(d.amount)}.`,
        );
      }
    }

    // Validate the account the money lands in (investment) or leaves (withdrawal).
    const account = await resolveReceivingAccount(prisma, d.paymentAccountId || null, null);
    const signedAmount = isWithdrawal ? -d.amount : d.amount;
    const code = refCode("CAP");
    await prisma.capitalEntry.create({
      data: {
        code,
        type: d.type,
        amount: signedAmount,
        source: d.source,
        paymentAccountId: account.paymentAccountId,
        entryDate: d.entryDate ? new Date(d.entryDate) : new Date(),
        receiptUrl: d.receiptUrl || null,
        note: d.note || null,
        recordedById: actor.id,
      },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "CAPITAL_RECORDED",
      entity: "CapitalEntry",
      entityId: code,
      summary: isWithdrawal
        ? `${actor.name} recorded an owner withdrawal ${code}: ${formatCurrency(d.amount)} to ${d.source}.`
        : `${actor.name} recorded capital ${code}: ${formatCurrency(d.amount)} from ${d.source}.`,
    });
    revalidateFinance();
    return ok(
      undefined,
      isWithdrawal
        ? `Withdrawal ${code} recorded — Business Capital reduced by ${formatCurrency(d.amount)}.`
        : `Capital entry ${code} recorded.`,
    );
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function removeCapital(id: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN", "FINANCE"]);
    const cap = await prisma.capitalEntry.findUnique({ where: { id } });
    if (!cap) return fail("Capital entry not found.");
    await prisma.capitalEntry.delete({ where: { id } });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "CAPITAL_REMOVED",
      entity: "CapitalEntry",
      entityId: cap.code,
      summary: `${actor.name} removed capital entry ${cap.code} (TSh ${cap.amount.toLocaleString()} from ${cap.source}).`,
    });
    revalidateFinance();
    return ok(undefined, `Capital entry ${cap.code} removed.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}
