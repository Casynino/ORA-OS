"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { refCode, formatCurrency } from "@/lib/utils";
import { EXPENSE_CATEGORY_VALUES, EXPENSE_LABELS } from "@/lib/expense-categories";
import { resolveReceivingAccount } from "@/lib/payment-methods";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
//  Operational Fund — the single pool the CEO allocates to Finance for daily
//  operations. Finance requests funds → CEO approves (adds to the balance) →
//  Finance records spending (auto-reduces the balance) → when low, request more.
//  Funding never creates an Expense; only actual spend does (source =
//  OPERATIONAL_FUND), so reports count each shilling exactly once.
// ─────────────────────────────────────────────────────────────────────────────

function revalidateFund() {
  for (const p of [
    "/finance",
    "/finance/operational-fund",
    "/finance/reports",
    "/admin",
    "/admin/finance",
    "/admin/finance/operational-fund",
    "/admin/finance/ledger",
  ])
    revalidatePath(p);
}


// ── Funding requests ────────────────────────────────────────────────────────

const requestSchema = z.object({
  amount: z.number().int().positive("Enter an amount.").max(1000000000),
  purpose: z.string().trim().min(3, "What are the funds for?").max(300),
  category: z.enum(EXPENSE_CATEGORY_VALUES).default("OFFICE"),
  note: z.string().max(500).optional().or(z.literal("")),
});

/** Finance requests an allocation to the Operational Fund — goes to the CEO. */
export async function requestOperationalFunds(
  input: z.infer<typeof requestSchema>,
): Promise<ActionResult<{ code: string }>> {
  try {
    const actor = await requireActor(["FINANCE", "ADMIN"]);
    const parsed = requestSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid request.");
    const d = parsed.data;
    const req = await prisma.pettyCashRequest.create({
      data: {
        code: refCode("OF"),
        amount: d.amount,
        purpose: d.purpose,
        category: d.category,
        note: d.note?.trim() || null,
        requestedById: actor.id,
      },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "OPERATIONAL_FUND_REQUESTED",
      entity: "PettyCashRequest",
      entityId: req.code,
      summary: `${actor.name} requested ${formatCurrency(d.amount)} for the Operational Fund (${req.code}, ${EXPENSE_LABELS[d.category]}) — awaiting CEO approval.`,
    });
    revalidateFund();
    return ok({ code: req.code }, `${req.code} sent to the CEO for approval.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** CEO approves — the allocation is treated as money leaving the company into
 *  the fund, so it's booked as a Company Expense IMMEDIATELY (money-out + cash
 *  down in the CEO's reports) and added to the fund balance to spend down. The
 *  CEO names the account the money is issued FROM, so it draws that balance down. */
export async function approveOperationalFundRequest(
  id: string,
  paymentAccountId?: string | null,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const req = await prisma.pettyCashRequest.findUnique({
      where: { id },
      include: { requestedBy: { select: { name: true } } },
    });
    if (!req) return fail("Request not found.");

    await prisma.$transaction(async (tx) => {
      // Atomic claim — a request can only be approved once, so the allocation
      // expense is booked exactly once.
      const claimed = await tx.pettyCashRequest.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "APPROVED", approvedById: admin.id, approvedAt: new Date() },
      });
      if (claimed.count === 0) throw new Error("This request was already reviewed.");
      // Validate the source account inside the claim so a bad account rolls the
      // whole approval back (rejects unknown/deactivated).
      const account = await resolveReceivingAccount(tx, paymentAccountId || null, null);
      // The money has left the company's control into the fund → a Company
      // Expense now. Finance's per-item spends are accountability records
      // against this float, NOT additional money-out.
      await tx.expense.create({
        data: {
          code: refCode("EXP"),
          source: "OPERATIONAL_FUND",
          category: req.category,
          amount: req.amount,
          purpose: `Operational Fund ${req.code} — ${req.purpose}`,
          note: `Allocated to ${req.requestedBy.name}`,
          paymentMethod: account.method,
          paymentAccountId: account.paymentAccountId,
          recordedById: admin.id,
        },
      });
    });

    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "OPERATIONAL_FUND_APPROVED",
      entity: "PettyCashRequest",
      entityId: req.code,
      summary: `CEO approved ${formatCurrency(req.amount)} for the Operational Fund (${req.code}) — booked as a company expense and allocated to ${req.requestedBy.name}.`,
    });
    revalidateFund();
    return ok(undefined, `${req.code} approved — ${formatCurrency(req.amount)} allocated (recorded as a company expense).`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function rejectOperationalFundRequest(id: string, note?: string): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const req = await prisma.pettyCashRequest.findUnique({ where: { id } });
    if (!req) return fail("Request not found.");
    const rejected = await prisma.pettyCashRequest.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "REJECTED", approvedById: admin.id, approvedAt: new Date(), adminNote: note?.trim() || null },
    });
    if (rejected.count === 0) return fail("This request was already reviewed.");
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "OPERATIONAL_FUND_REJECTED",
      entity: "PettyCashRequest",
      entityId: req.code,
      summary: `CEO rejected Operational Fund request ${req.code}${note?.trim() ? ` — ${note.trim()}` : ""}.`,
    });
    revalidateFund();
    return ok(undefined, "Request rejected.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Spending ────────────────────────────────────────────────────────────────

const spendSchema = z.object({
  amount: z.number().int().positive("Enter the amount spent.").max(1000000000),
  category: z.enum(EXPENSE_CATEGORY_VALUES).default("OFFICE"),
  description: z.string().trim().min(3, "What was this spent on?").max(300),
  vendor: z.string().max(160).optional().or(z.literal("")),
  expenseDate: z.string().optional().or(z.literal("")), // ISO date
  receiptRef: z.string().max(120).optional().or(z.literal("")),
  receiptUrl: z.string().max(15000000).optional().or(z.literal("")),
  note: z.string().max(500).optional().or(z.literal("")),
});

/** Finance records money spent from the Operational Fund — one Expense
 *  (source OPERATIONAL_FUND) that auto-reduces the balance. */
export async function recordOperationalExpense(
  input: z.infer<typeof spendSchema>,
): Promise<ActionResult<{ code: string }>> {
  try {
    const actor = await requireActor(["FINANCE", "ADMIN"]);
    const parsed = spendSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid expense.");
    const d = parsed.data;
    if (d.expenseDate && Number.isNaN(new Date(d.expenseDate).getTime()))
      return fail("The expense date is invalid.");

    const code = refCode("OS");
    let remaining = 0;
    await prisma.$transaction(async (tx) => {
      // Serialize every fund spend so two concurrent expenses can't each slip
      // under the balance and overspend the CEO's allocation.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('operational_fund'))`;
      const [funded, spent] = await Promise.all([
        tx.pettyCashRequest.aggregate({ _sum: { amount: true }, where: { status: "APPROVED" } }),
        tx.operationalSpend.aggregate({ _sum: { amount: true } }),
      ]);
      const balance = (funded._sum.amount ?? 0) - (spent._sum.amount ?? 0);
      // Can't spend money the fund doesn't have.
      if (d.amount > balance)
        throw new Error(
          `The Operational Fund only has ${formatCurrency(Math.max(0, balance))} left — request more funds before recording this.`,
        );
      remaining = balance - d.amount;
      // An accountability record — NOT a company Expense (the allocation was
      // already expensed at approval), so the P&L is never double-counted.
      await tx.operationalSpend.create({
        data: {
          code,
          category: d.category,
          amount: d.amount,
          description: d.description,
          note: [d.vendor?.trim() ? `Vendor: ${d.vendor.trim()}` : "", d.note?.trim() ?? ""].filter(Boolean).join(" · ") || null,
          receiptRef: d.receiptRef?.trim() || null,
          receiptUrl: d.receiptUrl?.trim() || null,
          expenseDate: d.expenseDate ? new Date(d.expenseDate) : new Date(),
          recordedById: actor.id,
        },
      });
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "OPERATIONAL_EXPENSE_RECORDED",
      entity: "Expense",
      entityId: code,
      summary: `${actor.name} spent ${formatCurrency(d.amount)} from the Operational Fund — ${d.description} (${EXPENSE_LABELS[d.category]})${d.vendor?.trim() ? ` · ${d.vendor.trim()}` : ""}.`,
    });
    revalidateFund();
    return ok({ code }, `Expense ${code} recorded — ${formatCurrency(remaining)} left in the fund.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Delete an operational-fund spending record (a correction) — returns that
 *  amount to the fund balance. Doesn't touch the P&L (spends aren't expenses). */
export async function removeOperationalExpense(id: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(["FINANCE", "ADMIN"]);
    const spend = await prisma.operationalSpend.findUnique({ where: { id } });
    if (!spend) return fail("Spending record not found.");
    await prisma.operationalSpend.delete({ where: { id } });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "OPERATIONAL_EXPENSE_REMOVED",
      entity: "OperationalSpend",
      entityId: spend.code,
      summary: `${actor.name} removed operational spend ${spend.code} (${formatCurrency(spend.amount)} — ${spend.description}).`,
    });
    revalidateFund();
    return ok(undefined, `Spending record ${spend.code} removed — ${formatCurrency(spend.amount)} returned to the fund.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}
