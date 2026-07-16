"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { CreditStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { refCode, formatCurrency } from "@/lib/utils";
import { completeCycleIfCleared } from "@/lib/services/credit";
import { resolveReceivingAccount } from "@/lib/payment-methods";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

function revalidateSettlements() {
  revalidatePath("/finance");
  revalidatePath("/finance/credit");
  revalidatePath("/partner/credit");
  revalidatePath("/admin/credit");
  revalidatePath("/admin/payments");
  revalidatePath("/admin");
}

const submitSchema = z.object({
  creditAccountId: z.string().min(1, "Choose a credit batch."),
  amount: z.number().int().positive().max(1000000000),
  method: z.string().max(40).optional(),
  paymentAccountId: z.string().max(60).optional(),
  reference: z.string().max(120).optional(),
});

// Partner submits a payment claim against one of their open credit batches.
export async function submitSettlement(
  input: z.infer<typeof submitSchema>,
): Promise<ActionResult<{ code: string }>> {
  try {
    const actor = await requireActor(["PARTNER"]);
    const parsed = submitSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid submission.");
    }
    const account = await prisma.creditAccount.findUnique({
      where: { id: parsed.data.creditAccountId },
    });
    if (!account || account.agentId !== actor.id) {
      return fail("Credit batch not found.");
    }
    if (account.status === "SETTLED") {
      return fail("That credit batch is already fully settled.");
    }
    const remaining = account.principal - account.amountPaid;
    if (parsed.data.amount > remaining) {
      return fail(
        `That's more than the ${formatCurrency(remaining)} remaining on this batch.`,
      );
    }

    // If the partner declared which company account they paid into, validate
    // it and derive the method from the account itself.
    const receiving = await resolveReceivingAccount(
      prisma,
      parsed.data.paymentAccountId || null,
      parsed.data.method,
    );

    const sr = await prisma.settlementRequest.create({
      data: {
        code: refCode("STL"),
        partnerId: actor.id,
        creditAccountId: account.id,
        amount: parsed.data.amount,
        method: receiving.method,
        paymentAccountId: receiving.paymentAccountId,
        reference: parsed.data.reference?.trim() || null,
        status: "PENDING",
      },
    });

    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "SETTLEMENT_SUBMITTED",
      entity: "SettlementRequest",
      entityId: sr.id,
      summary: `${actor.name} submitted a ${formatCurrency(parsed.data.amount)} payment for confirmation (${sr.code}).`,
    });

    revalidateSettlements();
    return ok({ code: sr.code }, "Payment submitted to the ORA team for confirmation.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// Admin confirms a partner's payment → posts it to the ledger.
export async function confirmSettlement(
  id: string,
  paymentAccountId?: string,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN", "FINANCE"]);
    const sr = await prisma.settlementRequest.findUnique({
      where: { id },
      include: { creditAccount: true },
    });
    if (!sr) return fail("Settlement not found.");
    if (sr.status !== "PENDING") return fail("This settlement has already been reviewed.");

    const account = sr.creditAccount;
    if (account.status === "SETTLED") {
      return fail("That credit batch is already settled.");
    }
    const remaining = account.principal - account.amountPaid;
    if (sr.amount > remaining) {
      return fail(
        `Amount exceeds the ${formatCurrency(remaining)} now remaining. Reject and ask the partner to resubmit.`,
      );
    }

    const newPaid = account.amountPaid + sr.amount;
    // OVERDUE stays sticky on partial settlement — only full repayment clears it.
    const status: CreditStatus =
      newPaid >= account.principal
        ? "SETTLED"
        : account.status === "OVERDUE"
          ? "OVERDUE"
          : "PARTIAL";

    const cycleMsg = await prisma.$transaction(async (tx) => {
      // Claim the settlement atomically — a double confirm matches 0 rows.
      const claimedSr = await tx.settlementRequest.updateMany({
        where: { id: sr.id, status: "PENDING" },
        data: {
          status: "CONFIRMED",
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      });
      if (claimedSr.count === 0) {
        throw new Error("This settlement was already reviewed.");
      }
      // Claim the account against the exact balance we validated — a
      // concurrent payment aborts instead of double-applying.
      const claimedAcc = await tx.creditAccount.updateMany({
        where: {
          id: account.id,
          status: { not: "SETTLED" },
          amountPaid: account.amountPaid,
        },
        data: { amountPaid: newPaid, status },
      });
      if (claimedAcc.count === 0) {
        throw new Error(
          "The account changed while confirming — refresh and review again.",
        );
      }
      // Record which company account the money landed in. The admin's pick at
      // confirmation wins; otherwise fall back to the account the partner
      // declared when submitting — but only while that account is still
      // active, so a deactivation never blocks confirmation.
      let accountToCredit = paymentAccountId || null;
      if (!accountToCredit && sr.paymentAccountId) {
        const declared = await tx.paymentAccount.findUnique({
          where: { id: sr.paymentAccountId },
        });
        if (declared?.isActive) accountToCredit = declared.id;
      }
      const receiving = await resolveReceivingAccount(
        tx,
        accountToCredit,
        sr.method,
      );
      const payment = await tx.payment.create({
        data: {
          creditAccountId: account.id,
          amount: sr.amount,
          // Derived from the account that actually received the money;
          // falls back to the partner-declared method when no account chosen.
          method: receiving.method,
          paymentAccountId: receiving.paymentAccountId,
          reference: sr.reference,
          note: `Partner settlement ${sr.code}${sr.reference ? ` · ${sr.reference}` : ""}`,
          recordedById: admin.id,
        },
      });
      await tx.settlementRequest.update({
        where: { id: sr.id },
        data: { paymentId: payment.id },
      });
      // Full repayment closes the cycle → score +1 and automatic limit growth
      // (when the cycle never went overdue). Available credit is restored
      // instantly either way, since it's computed live from open balances.
      if (status === "SETTLED") {
        return completeCycleIfCleared(tx, { partnerId: account.agentId });
      }
      return null;
    });

    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "SETTLEMENT_CONFIRMED",
      entity: "SettlementRequest",
      entityId: sr.id,
      summary: `Settlement ${sr.code} confirmed — ${formatCurrency(sr.amount)} posted (${status.toLowerCase()}).${cycleMsg ? ` ${cycleMsg}` : ""}`,
    });

    revalidateSettlements();
    return ok(
      undefined,
      cycleMsg ??
        (status === "SETTLED"
          ? "Confirmed — credit fully settled."
          : "Confirmed and posted to the ledger."),
    );
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function rejectSettlement(
  id: string,
  note?: string,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN", "FINANCE"]);
    const sr = await prisma.settlementRequest.findUnique({ where: { id } });
    if (!sr) return fail("Settlement not found.");
    if (sr.status !== "PENDING") return fail("This settlement has already been reviewed.");
    await prisma.settlementRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        note: note?.trim() || null,
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
    });
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "SETTLEMENT_REJECTED",
      entity: "SettlementRequest",
      entityId: sr.id,
      summary: `Settlement ${sr.code} rejected.`,
    });
    revalidateSettlements();
    return ok(undefined, "Settlement rejected.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}
