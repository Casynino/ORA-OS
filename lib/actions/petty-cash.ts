"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { resolveReceivingAccount } from "@/lib/payment-methods";
import { refCode, formatCurrency } from "@/lib/utils";
import { EXPENSE_CATEGORY_VALUES, EXPENSE_LABELS } from "@/lib/expense-categories";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
//  Petty cash accountability loop:
//  Finance requests an allocation → Admin approves (money leaves as an
//  Expense at that moment) → Finance records every expenditure against it →
//  Finance closes it with a reconciliation report.
// ─────────────────────────────────────────────────────────────────────────────

function revalidatePettyCash() {
  for (const p of ["/finance", "/finance/petty-cash", "/admin", "/admin/finance", "/admin/finance/petty-cash", "/admin/finance/expenses", "/finance/expenses", "/finance/reports"])
    revalidatePath(p);
}

const requestSchema = z.object({
  amount: z.number().int().positive().max(100000000),
  purpose: z.string().min(3, "What is this allocation for?").max(300),
  // Which office-spend category this fund covers — defaults to OFFICE so older
  // callers (and a blank pick) still validate.
  category: z.enum(EXPENSE_CATEGORY_VALUES).default("OFFICE"),
});

/** Finance requests a petty cash allocation — goes to admin for approval. */
export async function createPettyCashRequest(
  input: z.infer<typeof requestSchema>,
): Promise<ActionResult<{ code: string }>> {
  try {
    const actor = await requireActor(["FINANCE", "ADMIN"]);
    const parsed = requestSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid request.");
    }
    const req = await prisma.pettyCashRequest.create({
      data: {
        code: refCode("PC"),
        amount: parsed.data.amount,
        purpose: parsed.data.purpose.trim(),
        category: parsed.data.category,
        requestedById: actor.id,
      },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "PETTY_CASH_REQUESTED",
      entity: "PettyCashRequest",
      entityId: req.id,
      summary: `${actor.name} requested ${formatCurrency(req.amount)} office fund for ${EXPENSE_LABELS[req.category]} (${req.code}) — awaiting CEO approval.`,
    });
    revalidatePettyCash();
    return ok({ code: req.code }, `${req.code} sent to the admin for approval.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Admin approves — the money is issued NOW, recorded as an OFFICE expense
 * from the chosen company account, and finance can start spending it. */
export async function approvePettyCashRequest(
  id: string,
  paymentAccountId?: string,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const req = await prisma.pettyCashRequest.findUnique({
      where: { id },
      include: { requestedBy: { select: { name: true } } },
    });
    if (!req) return fail("Request not found.");

    await prisma.$transaction(async (tx) => {
      // Atomic claim — double approvals can't double-issue the cash.
      const claimed = await tx.pettyCashRequest.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: "APPROVED",
          approvedById: admin.id,
          approvedAt: new Date(),
        },
      });
      if (claimed.count === 0) {
        throw new Error("This request was already reviewed.");
      }
      const receiving = await resolveReceivingAccount(
        tx,
        paymentAccountId || null,
        "Cash",
      );
      if (receiving.paymentAccountId) {
        await tx.pettyCashRequest.update({
          where: { id },
          data: { paymentAccountId: receiving.paymentAccountId },
        });
      }
      // Money leaves the company at issue time — one expense for the whole
      // allocation, so it flows into every financial report immediately.
      await tx.expense.create({
        data: {
          code: refCode("EXP"),
          category: req.category,
          amount: req.amount,
          purpose: `Office fund ${req.code} — ${req.purpose}`,
          paymentMethod: receiving.method,
          note: `Issued to ${req.requestedBy.name}`,
          recordedById: admin.id,
        },
      });
    });

    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "PETTY_CASH_APPROVED",
      entity: "PettyCashRequest",
      entityId: req.id,
      summary: `Office fund ${req.code} (${EXPENSE_LABELS[req.category]}) approved — ${formatCurrency(req.amount)} issued to ${req.requestedBy.name}.`,
    });
    revalidatePettyCash();
    return ok(undefined, `${req.code} approved — ${formatCurrency(req.amount)} issued.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function rejectPettyCashRequest(
  id: string,
  note?: string,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const req = await prisma.pettyCashRequest.findUnique({ where: { id } });
    if (!req) return fail("Request not found.");
    const rejected = await prisma.pettyCashRequest.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status: "REJECTED",
        approvedById: admin.id,
        approvedAt: new Date(),
        adminNote: note?.trim() || null,
      },
    });
    if (rejected.count === 0) return fail("This request was already reviewed.");
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "PETTY_CASH_REJECTED",
      entity: "PettyCashRequest",
      entityId: req.id,
      summary: `Office fund ${req.code} rejected.`,
    });
    revalidatePettyCash();
    return ok(undefined, "Request rejected.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const spendSchema = z.object({
  requestId: z.string().min(1),
  description: z.string().min(2, "What was bought?").max(300),
  amount: z.number().int().positive().max(100000000),
  receiptRef: z.string().max(120).optional().or(z.literal("")),
  receiptUrl: z.string().max(500).optional().or(z.literal("")),
});

/** Finance records one expenditure against an approved allocation. */
export async function recordPettyCashExpense(
  input: z.infer<typeof spendSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["FINANCE", "ADMIN"]);
    const parsed = spendSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid expenditure.");
    }
    const d = parsed.data;

    let reqCode = "";
    await prisma.$transaction(async (tx) => {
      // Lock the allocation row so concurrent expenditures (and a concurrent
      // reconcile) serialize — the sum-check below is race-free.
      await tx.$queryRaw`SELECT id FROM "PettyCashRequest" WHERE id = ${d.requestId} FOR UPDATE`;
      const req = await tx.pettyCashRequest.findUnique({
        where: { id: d.requestId },
        include: { expenses: { select: { amount: true } } },
      });
      if (!req) throw new Error("Allocation not found.");
      if (req.status !== "APPROVED") {
        throw new Error("Expenditures can only be recorded against an approved, open allocation.");
      }
      reqCode = req.code;
      const spent = req.expenses.reduce((s, e) => s + e.amount, 0);
      if (spent + d.amount > req.amount) {
        throw new Error(
          `Only ${formatCurrency(req.amount - spent)} left on ${req.code} — this expenditure exceeds the allocation.`,
        );
      }
      await tx.pettyCashExpense.create({
        data: {
          requestId: req.id,
          description: d.description.trim(),
          amount: d.amount,
          receiptRef: d.receiptRef?.trim() || null,
          receiptUrl: d.receiptUrl?.trim() || null,
          recordedById: actor.id,
        },
      });
    });

    // Every office-fund expense streams to the CEO's financial activity feed —
    // finance spends without per-expense approval but nothing is hidden.
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "PETTY_CASH_SPENT",
      entity: "PettyCashRequest",
      entityId: d.requestId,
      summary: `Office fund ${reqCode}: spent ${formatCurrency(d.amount)} — ${d.description.trim()}${d.receiptRef?.trim() ? ` · receipt ${d.receiptRef.trim()}` : ""}.`,
    });
    revalidatePettyCash();
    return ok(undefined, "Expenditure recorded.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Finance closes the allocation with a reconciliation report. Any unspent
 * remainder is booked back (a negative offsetting expense) so reports never
 * overstate spend — the full allocation was expensed at issue time. */
export async function reconcilePettyCash(
  id: string,
  note?: string,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["FINANCE", "ADMIN"]);
    let spent = 0;
    let remaining = 0;
    let reqCode = "";
    await prisma.$transaction(async (tx) => {
      // Same lock as recordPettyCashExpense — an in-flight expenditure can't
      // slip in between our sum and the status flip.
      await tx.$queryRaw`SELECT id FROM "PettyCashRequest" WHERE id = ${id} FOR UPDATE`;
      const req = await tx.pettyCashRequest.findUnique({
        where: { id },
        include: { expenses: { select: { amount: true } } },
      });
      if (!req) throw new Error("Allocation not found.");
      reqCode = req.code;
      spent = req.expenses.reduce((s, e) => s + e.amount, 0);
      remaining = req.amount - spent;

      const closed = await tx.pettyCashRequest.updateMany({
        where: { id, status: "APPROVED" },
        data: {
          status: "RECONCILED",
          reconciledAt: new Date(),
          reconcileNote:
            `${note?.trim() ? `${note.trim()} · ` : ""}Spent ${formatCurrency(spent)} of ${formatCurrency(req.amount)} · ${formatCurrency(remaining)} returned/remaining`,
        },
      });
      if (closed.count === 0) {
        throw new Error("Only an open approved allocation can be reconciled.");
      }
      // The full allocation left the books at approval — book the returned
      // remainder back as a negative offsetting expense so spend is accurate.
      if (remaining > 0) {
        await tx.expense.create({
          data: {
            code: refCode("EXP"),
            category: req.category,
            amount: -remaining,
            purpose: `Office fund ${req.code} — unspent ${formatCurrency(remaining)} returned`,
            paymentMethod: "Cash",
            recordedById: actor.id,
          },
        });
      }
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "PETTY_CASH_RECONCILED",
      entity: "PettyCashRequest",
      entityId: id,
      summary: `Office fund ${reqCode} reconciled — ${formatCurrency(spent)} spent, ${formatCurrency(remaining)} remaining/returned.`,
    });
    revalidatePettyCash();
    return ok(undefined, `${reqCode} reconciled — ${formatCurrency(remaining)} returned to the books.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}
