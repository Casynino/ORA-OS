"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { CreditStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { refCode, formatCurrency } from "@/lib/utils";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

function revalidateSettlements() {
  revalidatePath("/partner/credit");
  revalidatePath("/admin/credit");
  revalidatePath("/admin");
}

const submitSchema = z.object({
  creditAccountId: z.string().min(1, "Choose a credit batch."),
  amount: z.number().int().positive().max(1000000000),
  method: z.string().max(40).optional(),
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

    const sr = await prisma.settlementRequest.create({
      data: {
        code: refCode("STL"),
        partnerId: actor.id,
        creditAccountId: account.id,
        amount: parsed.data.amount,
        method: parsed.data.method?.trim() || null,
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
export async function confirmSettlement(id: string): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
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
    const status: CreditStatus =
      newPaid >= account.principal ? "SETTLED" : "PARTIAL";

    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          creditAccountId: account.id,
          amount: sr.amount,
          method: sr.method,
          note: `Partner settlement ${sr.code}${sr.reference ? ` · ${sr.reference}` : ""}`,
          recordedById: admin.id,
        },
      });
      await tx.creditAccount.update({
        where: { id: account.id },
        data: { amountPaid: newPaid, status },
      });
      await tx.settlementRequest.update({
        where: { id: sr.id },
        data: {
          status: "CONFIRMED",
          reviewedById: admin.id,
          reviewedAt: new Date(),
          paymentId: payment.id,
        },
      });
    });

    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "SETTLEMENT_CONFIRMED",
      entity: "SettlementRequest",
      entityId: sr.id,
      summary: `Settlement ${sr.code} confirmed — ${formatCurrency(sr.amount)} posted (${status.toLowerCase()}).`,
    });

    revalidateSettlements();
    return ok(
      undefined,
      status === "SETTLED"
        ? "Confirmed — credit fully settled."
        : "Confirmed and posted to the ledger.",
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
    const admin = await requireActor(["ADMIN"]);
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
