"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { refCode, formatCurrency } from "@/lib/utils";
import { EXPENSE_CATEGORY_VALUES, EXPENSE_LABELS } from "@/lib/expense-categories";
import { resolveReceivingAccount, METHOD_LABEL } from "@/lib/payment-methods";
import { notifyExpensesRecorded } from "@/lib/notifications/ceo-alerts";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";
import type { ExpenseCategory } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
//  Expense Claims — Finance records COMPLETED (already-incurred) expenses as one
//  submission of one-or-more line items, each with a required receipt. The claim
//  sits PENDING and affects NOTHING (no account balance, no ledger, no P&L, no
//  report) until the CEO reviews the receipts, allocates a company account, and
//  approves — at which point one DIRECT Expense per item is booked against that
//  account, flowing into every existing money figure automatically.
//
//  This is NOT the Operational Fund (a request for a spending float). Here the
//  money is already spent; the CEO is verifying and allocating, not funding.
// ─────────────────────────────────────────────────────────────────────────────

function revalidateClaims() {
  for (const p of [
    "/finance",
    "/finance/operational-fund",
    "/admin",
    "/admin/finance",
    "/admin/finance/operational-fund",
    "/admin/finance/ledger",
    "/admin/finance/accounts",
  ])
    revalidatePath(p);
}

const MAX_INT4 = 2_147_483_647;

const itemSchema = z.object({
  category: z.enum(EXPENSE_CATEGORY_VALUES).default("OFFICE"),
  customCategory: z.string().max(60).optional().or(z.literal("")),
  description: z.string().max(200).optional().or(z.literal("")),
  amount: z.number().int().positive("Enter an amount.").max(MAX_INT4),
  // Proof is REQUIRED for every completed expense — that's the whole point.
  receiptUrl: z.string().min(1, "Attach a receipt for every expense.").max(15000000),
  receiptRef: z.string().max(80).optional().or(z.literal("")),
  note: z.string().max(300).optional().or(z.literal("")),
});

const submitSchema = z
  .object({
    items: z.array(itemSchema).min(1, "Add at least one expense.").max(50),
    note: z.string().max(300).optional().or(z.literal("")),
  })
  .refine((d) => d.items.reduce((s, it) => s + it.amount, 0) <= MAX_INT4, {
    message: "That total is too large — split it into separate submissions.",
  });

/** A line's shown label — its own description, else the category name. */
function itemDescription(it: {
  description?: string | null;
  customCategory?: string | null;
  category: ExpenseCategory;
}): string {
  return it.description?.trim() || it.customCategory?.trim() || EXPENSE_LABELS[it.category];
}

/** FINANCE (or ADMIN) records completed expenses — lands PENDING, books nothing. */
export async function submitExpenseClaim(
  input: z.infer<typeof submitSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["FINANCE", "ADMIN"]);
    const parsed = submitSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid submission.");
    const d = parsed.data;
    const total = d.items.reduce((s, it) => s + it.amount, 0);

    const claim = await prisma.expenseClaim.create({
      data: {
        code: refCode("EC"),
        status: "PENDING",
        note: d.note?.trim() || null,
        recordedById: actor.id,
        items: {
          create: d.items.map((it) => ({
            category: it.category,
            customCategory: it.customCategory?.trim() || null,
            description: itemDescription(it),
            amount: it.amount,
            receiptUrl: it.receiptUrl,
            receiptRef: it.receiptRef?.trim() || null,
            note: it.note?.trim() || null,
          })),
        },
      },
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "EXPENSE_CLAIM_SUBMITTED",
      entity: "ExpenseClaim",
      entityId: claim.code,
      summary: `${actor.name} recorded ${d.items.length} completed ${d.items.length === 1 ? "expense" : "expenses"} totaling ${formatCurrency(total)} (${claim.code}) — awaiting CEO review & account allocation.`,
    });

    revalidateClaims();
    // Alert the CEO after the commit (worded as recorded, not requested).
    await notifyExpensesRecorded(actor.name, d.items.length, total);

    return ok(
      undefined,
      `${d.items.length} ${d.items.length === 1 ? "expense" : "expenses"} recorded (${formatCurrency(total)}) — sent to the CEO for review & allocation.`,
    );
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const approveSchema = z.object({
  id: z.string().min(1),
  paymentAccountId: z.string().min(1, "Choose the company account to allocate these to."),
});

/** ADMIN verifies the receipts, allocates ONE account, and books the expenses. */
export async function approveExpenseClaim(
  input: z.infer<typeof approveSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN"]);
    const parsed = approveSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Choose an account.");
    const { id, paymentAccountId } = parsed.data;

    const claim = await prisma.expenseClaim.findUnique({
      where: { id },
      include: { items: true, recordedBy: { select: { name: true } } },
    });
    if (!claim) return fail("Submission not found.");

    await prisma.$transaction(async (tx) => {
      // Resolve + validate the allocation account (rejects unknown/inactive).
      const account = await resolveReceivingAccount(tx, paymentAccountId, null);
      // Atomic claim — only a still-pending submission can be approved once, so
      // the expenses are booked exactly once.
      const claimed = await tx.expenseClaim.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: "APPROVED",
          reviewedById: actor.id,
          reviewedAt: new Date(),
          paymentAccountId: account.paymentAccountId,
        },
      });
      if (claimed.count === 0) throw new Error("This submission was already reviewed.");

      // Book one DIRECT Expense per item, drawing down the allocated account.
      // recordedBy = the Finance user who incurred it (attribution), not the CEO
      // who merely approved — matches the operational-fund attribution rule.
      for (const it of claim.items) {
        await tx.expense.create({
          data: {
            code: refCode("EXP"),
            source: "DIRECT",
            category: it.category,
            customCategory: it.customCategory,
            amount: it.amount,
            purpose: it.description,
            vendor: null,
            receiptRef: it.receiptRef,
            receiptUrl: it.receiptUrl,
            note: it.note,
            paymentMethod: account.method,
            paymentAccountId: account.paymentAccountId,
            batchCode: claim.code,
            expenseClaimId: claim.id,
            recordedById: claim.recordedById,
          },
        });
      }
    });

    const total = claim.items.reduce((s, it) => s + it.amount, 0);
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "EXPENSE_CLAIM_APPROVED",
      entity: "ExpenseClaim",
      entityId: claim.code,
      summary: `${actor.name} approved ${claim.items.length} ${claim.items.length === 1 ? "expense" : "expenses"} (${formatCurrency(total)}) recorded by ${claim.recordedBy.name} (${claim.code}) — booked as ORA expenses.`,
    });

    revalidateClaims();
    return ok(
      undefined,
      `${claim.items.length} ${claim.items.length === 1 ? "expense" : "expenses"} approved — ${formatCurrency(total)} booked to the account.`,
    );
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** ADMIN declines a submission — nothing is booked, no account is touched. */
export async function rejectExpenseClaim(id: string, note?: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN"]);
    const claim = await prisma.expenseClaim.findUnique({
      where: { id },
      include: { items: true, recordedBy: { select: { name: true } } },
    });
    if (!claim) return fail("Submission not found.");

    const claimed = await prisma.expenseClaim.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status: "REJECTED",
        reviewedById: actor.id,
        reviewedAt: new Date(),
        reviewNote: note?.trim() || "Rejected by CEO",
      },
    });
    if (claimed.count === 0) return fail("This submission was already reviewed.");

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "EXPENSE_CLAIM_REJECTED",
      entity: "ExpenseClaim",
      entityId: claim.code,
      summary: `${actor.name} rejected ${claim.items.length} ${claim.items.length === 1 ? "expense" : "expenses"} recorded by ${claim.recordedBy.name} (${claim.code})${note?.trim() ? ` — ${note.trim()}` : ""}. Nothing was booked.`,
    });

    revalidateClaims();
    return ok(undefined, `Submission ${claim.code} rejected — nothing was booked.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}
