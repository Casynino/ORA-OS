"use server";

import { revalidatePath } from "next/cache";
import type { FieldCreditStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { applyMovement } from "@/lib/services/inventory";
import { refCode } from "@/lib/utils";
import { isCashMethod } from "@/lib/payment-methods";
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
    "/finance/cash",
    "/admin",
    "/admin/credit",
    "/admin/finance",
    "/admin/finance/accounts",
    "/admin/finance/cash",
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

/** Finance confirms a rep sale.
 *  - PHYSICAL CASH sale → "cash received from the rep": becomes revenue and
 *    goes to Cash on Hand (RECEIVED). The bank account + deposit slip are NOT
 *    captured here — that happens later at the weekly/monthly bank deposit.
 *  - BANK / MOBILE / CHEQUE sale → the rep's proof is already attached; finance
 *    just verifies it and confirms. No re-upload; the account is already set.
 *  - CREDIT sale → validates the terms (no money moves).
 */
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

    const physicalCash = sale.type === "CASH" && isCashMethod(sale.paymentMethod);

    // Atomic claim — two reviewers can't both confirm it. We never overwrite the
    // rep's proof or the sale-time account here; deposited-cash attribution moves
    // to createCashDeposit, and direct payments already carry their account.
    const claimed = await prisma.fieldSale.updateMany({
      where: { id, financeStatus: "PENDING", voided: false },
      data: {
        financeStatus: "APPROVED",
        financeReviewedById: actor.id,
        financeReviewedAt: new Date(),
        financeNote: note?.trim() || null,
        ...(physicalCash ? { cashStatus: "RECEIVED", cashReceivedAt: new Date() } : {}),
      },
    });
    if (claimed.count === 0) return fail("This sale was already reviewed.");

    const who = sale.customer?.name ?? sale.customerName ?? "walk-in customer";
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action:
        sale.type === "CREDIT"
          ? "FIELD_CREDIT_APPROVED"
          : "FIELD_SALE_CONFIRMED",
      entity: "FieldSale",
      entityId: sale.code,
      summary:
        sale.type === "CREDIT"
          ? `Finance approved a credit sale of TSh ${sale.total.toLocaleString()} to ${who} (${sale.code}, rep ${sale.rep.name}).`
          : physicalCash
            ? `Finance confirmed TSh ${sale.total.toLocaleString()} cash received from ${sale.rep.name} for ${who} (${sale.code}) — now in Cash on Hand.`
            : `Finance verified the ${sale.paymentMethod ?? "payment"} for ${who} (${sale.code}, rep ${sale.rep.name}) — TSh ${sale.total.toLocaleString()}.`,
    });
    revalidateApprovals();
    return ok(
      undefined,
      sale.type === "CREDIT"
        ? `${sale.code} approved — now an official company credit sale.`
        : physicalCash
          ? `${sale.code} confirmed — cash received and now in Cash on Hand.`
          : `${sale.code} confirmed — the payment is verified.`,
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
          // Rejected money leaves cash-on-hand too — otherwise a rejected cash
          // collection would sit in Cash on Hand forever (never bankable).
          cashStatus: null,
          cashReceivedAt: null,
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

    // A physical-cash collection goes to Cash on Hand until it's banked; a
    // direct bank/mobile collection already landed in its account.
    const physicalCash = isCashMethod(payment.method);

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
          ...(physicalCash ? { cashStatus: "RECEIVED", cashReceivedAt: new Date() } : {}),
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

// ── Bank deposits — banking a batch of held cash ────────────────────────────

export type CreateCashDepositInput = {
  saleIds: string[];
  paymentIds: string[];
  depositAccountId: string; // the company bank/mobile account it was banked into
  depositDate: string; // ISO date the cash was physically banked
  slipUrl?: string; // uploaded deposit-slip image (required)
  slipRef?: string; // slip number / bank reference
  note?: string;
};

/** Finance banks a BATCH of already-received cash. Selects cash sales +
 *  collections that are on hand (RECEIVED), records the receiving bank account,
 *  deposit date and slip, marks them DEPOSITED (moving them out of Cash on Hand
 *  and into that account), and creates a Deposit record linking them all. */
export async function createCashDeposit(
  input: CreateCashDepositInput,
): Promise<ActionResult<{ code: string }>> {
  try {
    const actor = await requireActor(["FINANCE", "ADMIN"]);
    const saleIds = [...new Set(input.saleIds ?? [])];
    const paymentIds = [...new Set(input.paymentIds ?? [])];
    if (saleIds.length + paymentIds.length === 0)
      return fail("Select at least one cash collection to deposit.");

    const account = await prisma.paymentAccount.findUnique({
      where: { id: input.depositAccountId },
    });
    if (!account || !account.isActive)
      return fail("Choose a valid company account to deposit into.");
    if (account.type === "CASH")
      return fail("Deposit into a bank or mobile-money account, not the cash office.");

    const depositDate = new Date(input.depositDate);
    if (!input.depositDate || Number.isNaN(depositDate.getTime()))
      return fail("Pick a valid deposit date.");
    if (!input.slipUrl?.trim())
      return fail("Attach the deposit slip.");

    const code = refCode("DEP");
    let total = 0;
    await prisma.$transaction(async (tx) => {
      // Re-read the selected rows, guarded to on-hand cash only, and total them
      // server-side (never trust a client-supplied sum).
      const sales = saleIds.length
        ? await tx.fieldSale.findMany({
            where: { id: { in: saleIds }, cashStatus: "RECEIVED", financeStatus: "APPROVED", voided: false },
            select: { id: true, total: true },
          })
        : [];
      const payments = paymentIds.length
        ? await tx.fieldPayment.findMany({
            where: { id: { in: paymentIds }, cashStatus: "RECEIVED", financeStatus: "APPROVED", sale: { is: { voided: false } } },
            select: { id: true, amount: true },
          })
        : [];
      if (sales.length !== saleIds.length || payments.length !== paymentIds.length)
        throw new Error("Some selected cash was already deposited or changed — refresh and try again.");

      total = sales.reduce((a, s) => a + s.total, 0) + payments.reduce((a, p) => a + p.amount, 0);
      if (total <= 0) throw new Error("The deposit total must be greater than zero.");

      const deposit = await tx.cashDeposit.create({
        data: {
          code,
          depositAccountId: account.id,
          total,
          depositDate,
          slipUrl: input.slipUrl!.trim(),
          slipRef: input.slipRef?.trim() || null,
          note: input.note?.trim() || null,
          depositedById: actor.id,
        },
      });

      // Bank the cash: move it out of hand and attribute it to this account.
      // The updateMany guards MIRROR the findMany guards exactly, so a sale
      // voided/rejected between the re-read and here drops the count and rolls
      // the whole deposit back (the CashDeposit.total must never include money
      // the account balance excludes).
      if (saleIds.length) {
        const done = await tx.fieldSale.updateMany({
          where: { id: { in: saleIds }, cashStatus: "RECEIVED", financeStatus: "APPROVED", voided: false },
          data: { cashStatus: "DEPOSITED", cashDepositId: deposit.id, paymentAccountId: account.id },
        });
        if (done.count !== saleIds.length)
          throw new Error("A selected cash sale changed while depositing — refresh and try again.");
      }
      if (paymentIds.length) {
        const done = await tx.fieldPayment.updateMany({
          where: { id: { in: paymentIds }, cashStatus: "RECEIVED", financeStatus: "APPROVED", sale: { is: { voided: false } } },
          data: { cashStatus: "DEPOSITED", cashDepositId: deposit.id, paymentAccountId: account.id },
        });
        if (done.count !== paymentIds.length)
          throw new Error("A selected collection changed while depositing — refresh and try again.");
      }
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "CASH_DEPOSIT_CREATED",
      entity: "CashDeposit",
      entityId: code,
      summary: `${actor.name} banked TSh ${total.toLocaleString()} into ${account.name} (${code}) — ${saleIds.length + paymentIds.length} cash collection(s).`,
    });
    revalidateApprovals();
    return ok({ code }, `Deposit ${code} recorded — TSh ${total.toLocaleString()} banked into ${account.name}.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}
