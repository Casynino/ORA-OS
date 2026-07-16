"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { refCode } from "@/lib/utils";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

// Every shilling leaving ORA is recorded, categorised and tied to the admin
// who approved it. No expense without a record; no income without a source.

const EXPENSE_CATEGORIES = [
  "RENT", "UTILITIES", "STATIONERY", "OFFICE",
  "SALARIES", "ALLOWANCES", "TRANSPORT_REIMBURSEMENT",
  "DELIVERY", "WAREHOUSE_HANDLING", "TRANSPORT_OF_GOODS",
  "STOCK_PURCHASE", "IMPORT_COSTS", "PACKAGING", "MARKETING",
  "TAXES", "INTERNET", "EQUIPMENT",
  "OTHER",
] as const;

const CAPITAL_TYPES = [
  "FOUNDER_INVESTMENT", "INVESTMENT", "PROFIT_REINVESTED", "GRANT", "OTHER",
] as const;

function revalidateFinance() {
  for (const p of ["/admin/finance", "/admin/finance/expenses", "/admin/finance/capital", "/admin/finance/ledger", "/admin", "/finance", "/finance/expenses", "/finance/reports"])
    revalidatePath(p);
}

const expenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.number().int().positive().max(1000000000),
  purpose: z.string().min(3, "What was this expense for?").max(200),
  paymentMethod: z.string().max(40).optional().or(z.literal("")),
  expenseDate: z.string().optional().or(z.literal("")), // ISO date
  note: z.string().max(500).optional().or(z.literal("")),
});

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
        amount: d.amount,
        purpose: d.purpose,
        paymentMethod: d.paymentMethod || null,
        expenseDate: d.expenseDate ? new Date(d.expenseDate) : new Date(),
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
    // System-generated expenses embody an admin approval (petty cash issue,
    // paid payroll) — finance must not be able to erase that control record.
    const systemGenerated = /^(Petty cash PC-|Payroll PAY-)/.test(exp.purpose);
    if (systemGenerated && actor.role !== "ADMIN") {
      return fail(
        "This expense was created by an approval workflow (petty cash / payroll) — only the admin can remove it.",
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
  source: z.string().min(2, "Where did this capital come from?").max(160),
  entryDate: z.string().optional().or(z.literal("")),
  note: z.string().max(500).optional().or(z.literal("")),
});

export async function recordCapital(
  input: z.infer<typeof capitalSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN", "FINANCE"]);
    const parsed = capitalSchema.safeParse(input);
    if (!parsed.success)
      return fail(parsed.error.issues[0]?.message ?? "Invalid capital entry.");
    const d = parsed.data;
    const code = refCode("CAP");
    await prisma.capitalEntry.create({
      data: {
        code,
        type: d.type,
        amount: d.amount,
        source: d.source,
        entryDate: d.entryDate ? new Date(d.entryDate) : new Date(),
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
      summary: `${actor.name} recorded capital ${code}: TSh ${d.amount.toLocaleString()} from ${d.source}.`,
    });
    revalidateFinance();
    return ok(undefined, `Capital entry ${code} recorded.`);
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
