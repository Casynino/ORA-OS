"use server";

import { revalidatePath } from "next/cache";
import type { FieldCreditStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { applyMovement } from "@/lib/services/inventory";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
//  Finance verification of rep-recorded money. Nothing a rep records becomes
//  official company revenue / receivables until finance confirms it here.
// ─────────────────────────────────────────────────────────────────────────────

function revalidateApprovals() {
  for (const p of [
    "/finance",
    "/finance/sales-approvals",
    "/finance/credit",
    "/finance/accounts",
    "/admin",
    "/admin/credit",
    "/admin/finance",
    "/admin/reps",
    "/rep",
    "/rep/sell",
    "/rep/customers",
  ])
    revalidatePath(p);
}

function creditStatusFor(
  total: number,
  paid: number,
  dueDate: Date | null,
): FieldCreditStatus {
  if (paid >= total) return "PAID";
  if (dueDate && dueDate < new Date()) return "OVERDUE";
  return paid > 0 ? "PARTIAL" : "PENDING";
}

export type ConfirmDeposit = {
  // For CASH: the official ORA account the cash was deposited into (or the
  // account a direct bank/Lipa payment landed in). Updates where the money
  // is traced. Ignored for CREDIT (no money moves at approval).
  depositAccountId?: string;
  // Deposit slip / receipt reference or link — proof of the money.
  proofRef?: string;
  // Uploaded deposit-slip / receipt image URL.
  proofUrl?: string;
  note?: string;
};

/** Finance confirms a rep sale. For a CASH sale finance records where the
 * money was banked and attaches proof (deposit slip / receipt); for a CREDIT
 * sale it validates the terms. Only now does it count as company money. */
export async function approveFieldSale(
  id: string,
  input?: ConfirmDeposit,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["FINANCE", "ADMIN"]);
    const { depositAccountId, proofRef, proofUrl, note } = input ?? {};
    const sale = await prisma.fieldSale.findUnique({
      where: { id },
      include: {
        rep: { select: { name: true } },
        customer: { select: { name: true } },
      },
    });
    if (!sale) return fail("Sale not found.");
    if (sale.voided) return fail("This sale was voided.");

    // For cash, record which company account the money was deposited into.
    let depositAccountUpdate: { paymentAccountId?: string } = {};
    if (sale.type === "CASH") {
      if (depositAccountId) {
        const acc = await prisma.paymentAccount.findUnique({
          where: { id: depositAccountId },
        });
        if (!acc || !acc.isActive) {
          return fail("Choose a valid company account to deposit into.");
        }
        depositAccountUpdate = { paymentAccountId: acc.id };
      } else if (await prisma.paymentAccount.count({ where: { isActive: true } })) {
        // The CEO owns the accounts — cash has to be traced into one of them.
        // (If none are configured yet we allow confirmation rather than lock it.)
        return fail("Choose the company account the cash was deposited into.");
      }
    }

    // Atomic claim — two reviewers can't both confirm it.
    const claimed = await prisma.fieldSale.updateMany({
      where: { id, financeStatus: "PENDING", voided: false },
      data: {
        financeStatus: "APPROVED",
        financeReviewedById: actor.id,
        financeReviewedAt: new Date(),
        financeNote: note?.trim() || null,
        depositProofRef: proofRef?.trim() || null,
        // Only overwrite the rep's uploaded proof if finance attaches its own
        // (e.g. the bank deposit slip for a cash sale).
        ...(proofUrl?.trim() ? { paymentProofUrl: proofUrl.trim() } : {}),
        ...depositAccountUpdate,
      },
    });
    if (claimed.count === 0) return fail("This sale was already reviewed.");

    const who = sale.customer?.name ?? sale.customerName ?? "walk-in customer";
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: sale.type === "CASH" ? "FIELD_SALE_CONFIRMED" : "FIELD_CREDIT_APPROVED",
      entity: "FieldSale",
      entityId: sale.code,
      summary:
        sale.type === "CASH"
          ? `Finance confirmed TSh ${sale.total.toLocaleString()} cash received from ${who} (${sale.code}, rep ${sale.rep.name})${proofRef?.trim() ? ` · deposit ref ${proofRef.trim()}` : ""}.`
          : `Finance approved a credit sale of TSh ${sale.total.toLocaleString()} to ${who} (${sale.code}, rep ${sale.rep.name}).`,
    });
    revalidateApprovals();
    return ok(
      undefined,
      sale.type === "CASH"
        ? `${sale.code} confirmed — the cash is now official revenue.`
        : `${sale.code} approved — now an official company credit sale.`,
    );
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Finance rejects a rep sale — it never becomes company money. The rep sees
 * the comment; an admin void remains the tool to put stock back. */
export async function rejectFieldSale(
  id: string,
  note?: string,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["FINANCE", "ADMIN"]);
    const sale = await prisma.fieldSale.findUnique({
      where: { id },
      include: { items: true, rep: { select: { id: true, name: true } } },
    });
    if (!sale) return fail("Sale not found.");

    await prisma.$transaction(async (tx) => {
      // Claim the review atomically — only a still-pending sale can be rejected.
      const claimed = await tx.fieldSale.updateMany({
        where: { id, financeStatus: "PENDING", voided: false },
        data: {
          financeStatus: "REJECTED",
          financeReviewedById: actor.id,
          financeReviewedAt: new Date(),
          financeNote: note?.trim() || "Rejected by finance",
        },
      });
      if (claimed.count === 0) throw new Error("This sale was already reviewed.");

      // A rejected sale never happened: the units the rep recorded as sold go
      // back into their hands (mirror of voidFieldSale) so a corrected
      // re-record doesn't double-deduct their stock, and the org ledger and
      // the rep's own totals stay accurate.
      for (const item of sale.items) {
        await applyMovement(tx, {
          productId: item.productId,
          type: "RESTOCKED",
          quantity: item.quantity,
          createdById: actor.id,
          reference: `REJECT ${sale.code}`,
          note: `Customer → ${sale.rep.name} (sale rejected by finance)`,
        });
        await applyMovement(tx, {
          productId: item.productId,
          type: "ASSIGNED",
          quantity: item.quantity,
          createdById: actor.id,
          reference: `REJECT ${sale.code}`,
          note: `Stock back in ${sale.rep.name}'s hands`,
        });
        await tx.repStock.update({
          where: { repId_productId: { repId: sale.repId, productId: item.productId } },
          data: {
            sellableQty: { increment: item.quantity },
            soldQty: { decrement: item.quantity },
          },
        });
      }

      // Any collections against this sale are moot now. Reject EVERY
      // non-rejected payment (not just pending): a finance/admin direct
      // collection posts as APPROVED, and unless we clear it here it would
      // stay attached to this now-rejected sale and leak into cash totals
      // (finance.ts / command-center / account balances count APPROVED
      // payments whose sale isn't voided).
      await tx.fieldPayment.updateMany({
        where: { saleId: sale.id, financeStatus: { not: "REJECTED" } },
        data: {
          financeStatus: "REJECTED",
          financeReviewedById: actor.id,
          financeReviewedAt: new Date(),
          financeNote: `Sale rejected: ${note?.trim() || "no reason given"}`,
        },
      });
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "FIELD_SALE_REJECTED",
      entity: "FieldSale",
      entityId: sale.code,
      summary: `Finance rejected ${sale.type.toLowerCase()} sale ${sale.code} (rep ${sale.rep.name})${note?.trim() ? ` — ${note.trim()}` : ""}. Stock returned to ${sale.rep.name}.`,
    });
    revalidateApprovals();
    return ok(undefined, `${sale.code} rejected — stock returned to ${sale.rep.name}; the rep can see your comment and re-record it.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Finance verifies a rep-claimed collection — only now does it reduce the
 * customer's outstanding balance and count as money in. */
export async function approveFieldCollection(
  paymentId: string,
  input?: ConfirmDeposit,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["FINANCE", "ADMIN"]);
    const { depositAccountId, proofRef, proofUrl, note } = input ?? {};
    const payment = await prisma.fieldPayment.findUnique({
      where: { id: paymentId },
      include: {
        sale: { include: { customer: { select: { name: true } } } },
        recordedBy: { select: { name: true } },
      },
    });
    if (!payment) return fail("Collection not found.");
    const sale = payment.sale;
    if (sale.voided) return fail("The underlying sale was voided.");
    if (sale.financeStatus !== "APPROVED") {
      return fail("Approve the credit sale itself first — then post its collections.");
    }
    const balance = sale.total - sale.amountPaid;
    if (payment.amount > balance) {
      return fail(
        `Amount exceeds the outstanding balance (TSh ${balance.toLocaleString()}). Reject it and ask the rep to re-submit.`,
      );
    }

    // Record which company account this collection was deposited into.
    let depositAccountUpdate: { paymentAccountId?: string } = {};
    if (depositAccountId) {
      const acc = await prisma.paymentAccount.findUnique({
        where: { id: depositAccountId },
      });
      if (!acc || !acc.isActive) {
        return fail("Choose a valid company account to deposit into.");
      }
      depositAccountUpdate = { paymentAccountId: acc.id };
    }

    const newPaid = sale.amountPaid + payment.amount;
    await prisma.$transaction(async (tx) => {
      // Claim the payment — double approvals can't double-post.
      const claimedPayment = await tx.fieldPayment.updateMany({
        where: { id: paymentId, financeStatus: "PENDING" },
        data: {
          financeStatus: "APPROVED",
          financeReviewedById: actor.id,
          financeReviewedAt: new Date(),
          financeNote: note?.trim() || null,
          depositProofRef: proofRef?.trim() || null,
          ...(proofUrl?.trim() ? { paymentProofUrl: proofUrl.trim() } : {}),
          ...depositAccountUpdate,
        },
      });
      if (claimedPayment.count === 0) {
        throw new Error("This collection was already reviewed.");
      }
      // Apply to the sale against the exact balance we validated.
      const claimedSale = await tx.fieldSale.updateMany({
        where: { id: sale.id, amountPaid: sale.amountPaid, voided: false },
        data: {
          amountPaid: newPaid,
          creditStatus: creditStatusFor(sale.total, newPaid, sale.dueDate),
        },
      });
      if (claimedSale.count === 0) {
        throw new Error("The sale changed while confirming — refresh and review again.");
      }
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "FIELD_COLLECTION_CONFIRMED",
      entity: "FieldSale",
      entityId: sale.code,
      summary: `Finance confirmed TSh ${payment.amount.toLocaleString()} collected on ${sale.code}${sale.customer ? ` (${sale.customer.name})` : ""} — submitted by ${payment.recordedBy.name}.`,
    });
    revalidateApprovals();
    return ok(undefined, "Collection confirmed and posted to the customer's balance.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function rejectFieldCollection(
  paymentId: string,
  note?: string,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["FINANCE", "ADMIN"]);
    const payment = await prisma.fieldPayment.findUnique({
      where: { id: paymentId },
      include: { sale: { select: { code: true } }, recordedBy: { select: { name: true } } },
    });
    if (!payment) return fail("Collection not found.");

    const claimed = await prisma.fieldPayment.updateMany({
      where: { id: paymentId, financeStatus: "PENDING" },
      data: {
        financeStatus: "REJECTED",
        financeReviewedById: actor.id,
        financeReviewedAt: new Date(),
        financeNote: note?.trim() || "Rejected by finance",
      },
    });
    if (claimed.count === 0) return fail("This collection was already reviewed.");

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "FIELD_COLLECTION_REJECTED",
      entity: "FieldSale",
      entityId: payment.sale.code,
      summary: `Finance rejected a TSh ${payment.amount.toLocaleString()} collection on ${payment.sale.code} (submitted by ${payment.recordedBy.name})${note?.trim() ? ` — ${note.trim()}` : ""}.`,
    });
    revalidateApprovals();
    return ok(undefined, "Collection rejected — nothing was posted.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}
