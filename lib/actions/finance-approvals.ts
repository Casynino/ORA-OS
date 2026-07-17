"use server";

import { revalidatePath } from "next/cache";
import type { FieldCreditStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
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

/** Finance confirms a rep sale — cash verified in the channel, or credit
 * terms validated. Only now does it count as company money. */
export async function approveFieldSale(
  id: string,
  note?: string,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["FINANCE", "ADMIN"]);
    const sale = await prisma.fieldSale.findUnique({
      where: { id },
      include: {
        rep: { select: { name: true } },
        customer: { select: { name: true } },
      },
    });
    if (!sale) return fail("Sale not found.");
    if (sale.voided) return fail("This sale was voided.");

    // Atomic claim — two reviewers can't both confirm it.
    const claimed = await prisma.fieldSale.updateMany({
      where: { id, financeStatus: "PENDING", voided: false },
      data: {
        financeStatus: "APPROVED",
        financeReviewedById: actor.id,
        financeReviewedAt: new Date(),
        financeNote: note?.trim() || null,
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
          ? `Finance confirmed TSh ${sale.total.toLocaleString()} cash received from ${who} (${sale.code}, rep ${sale.rep.name}).`
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
      include: { rep: { select: { name: true } } },
    });
    if (!sale) return fail("Sale not found.");

    const claimed = await prisma.fieldSale.updateMany({
      where: { id, financeStatus: "PENDING", voided: false },
      data: {
        financeStatus: "REJECTED",
        financeReviewedById: actor.id,
        financeReviewedAt: new Date(),
        financeNote: note?.trim() || "Rejected by finance",
      },
    });
    if (claimed.count === 0) return fail("This sale was already reviewed.");

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "FIELD_SALE_REJECTED",
      entity: "FieldSale",
      entityId: sale.code,
      summary: `Finance rejected ${sale.type.toLowerCase()} sale ${sale.code} (rep ${sale.rep.name})${note?.trim() ? ` — ${note.trim()}` : ""}.`,
    });
    revalidateApprovals();
    return ok(undefined, `${sale.code} rejected — the rep can see your comment.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Finance verifies a rep-claimed collection — only now does it reduce the
 * customer's outstanding balance and count as money in. */
export async function approveFieldCollection(
  paymentId: string,
  note?: string,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["FINANCE", "ADMIN"]);
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
