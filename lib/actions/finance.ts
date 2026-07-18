"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { refCode } from "@/lib/utils";
import { EXPENSE_CATEGORY_VALUES } from "@/lib/expense-categories";
import { getBusinessCapital } from "@/lib/services/finance";
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

const expenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORY_VALUES),
  customCategory: z.string().max(60).optional().or(z.literal("")),
  amount: z.number().int().positive().max(1000000000),
  purpose: z.string().min(3, "What was this expense for?").max(200),
  vendor: z.string().max(160).optional().or(z.literal("")),
  paymentMethod: z.string().max(40).optional().or(z.literal("")),
  expenseDate: z.string().optional().or(z.literal("")), // ISO date
  receiptUrl: z.string().max(15000000).optional().or(z.literal("")), // data-URL image ok
  note: z.string().max(500).optional().or(z.literal("")),
});

/** Record a company expense. An ADMIN (CEO) records a DIRECT expense that takes
 *  effect immediately — no approval, since the CEO is final authority — and it
 *  reduces Business Capital automatically (all money-out is derived from here). */
export async function recordExpense(
  input: z.infer<typeof expenseSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN", "FINANCE"]);
    const parsed = expenseSchema.safeParse(input);
    if (!parsed.success)
      return fail(parsed.error.issues[0]?.message ?? "Invalid expense.");
    const d = parsed.data;
    const code = refCode("EXP");
    await prisma.expense.create({
      data: {
        code,
        category: d.category,
        customCategory: d.customCategory?.trim() || null,
        amount: d.amount,
        purpose: d.purpose,
        vendor: d.vendor?.trim() || null,
        paymentMethod: d.paymentMethod || null,
        expenseDate: d.expenseDate ? new Date(d.expenseDate) : new Date(),
        receiptUrl: d.receiptUrl || null,
        note: d.note || null,
        recordedById: actor.id,
      },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "EXPENSE_RECORDED",
      entity: "Expense",
      entityId: code,
      summary: `${actor.name} recorded expense ${code}: TSh ${d.amount.toLocaleString()} — ${d.purpose}.`,
    });
    revalidateFinance();
    return ok(undefined, `Expense ${code} recorded.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
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

    const signedAmount = isWithdrawal ? -d.amount : d.amount;
    const code = refCode("CAP");
    await prisma.capitalEntry.create({
      data: {
        code,
        type: d.type,
        amount: signedAmount,
        source: d.source,
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
