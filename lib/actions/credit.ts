"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { CreditStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { completeCycleIfCleared } from "@/lib/services/credit";
import { resolveReceivingAccount } from "@/lib/payment-methods";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

function revalidateCredit() {
  revalidatePath("/admin/credit");
  revalidatePath("/admin");
  revalidatePath("/finance");
  revalidatePath("/finance/credit");
  revalidatePath("/partner");
  revalidatePath("/partner/credit");
}

const paymentSchema = z.object({
  creditAccountId: z.string().min(1),
  amount: z.number().int().positive().max(100000000),
  method: z.string().max(40).optional(),
  paymentAccountId: z.string().optional().or(z.literal("")),
  reference: z.string().max(80).optional().or(z.literal("")),
  collectedBy: z.string().max(80).optional(),
  note: z.string().max(500).optional(),
});

export async function recordPayment(
  input: z.infer<typeof paymentSchema>,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN", "FINANCE"]);
    const parsed = paymentSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid payment.");

    const account = await prisma.creditAccount.findUnique({
      where: { id: parsed.data.creditAccountId },
      include: { request: true },
    });
    if (!account) return fail("Credit account not found.");
    if (account.status === "SETTLED") {
      return fail("This credit account is already settled.");
    }
    const remaining = account.principal - account.amountPaid;
    if (parsed.data.amount > remaining) {
      return fail(
        `Payment exceeds the remaining balance of ${remaining}. Enter ${remaining} or less.`,
      );
    }

    const newPaid = account.amountPaid + parsed.data.amount;
    // OVERDUE is sticky: a partial payment reduces the balance but does NOT
    // restore the facility — only full settlement clears the flag.
    const status: CreditStatus =
      newPaid >= account.principal
        ? "SETTLED"
        : account.status === "OVERDUE"
          ? "OVERDUE"
          : newPaid > 0
            ? "PARTIAL"
            : "OUTSTANDING";

    const note = [
      parsed.data.collectedBy?.trim()
        ? `Collected by ${parsed.data.collectedBy.trim()}`
        : "",
      parsed.data.note?.trim() ?? "",
    ]
      .filter(Boolean)
      .join(" · ");

    const cycleMsg = await prisma.$transaction(async (tx) => {
      // Atomic claim: only applies on top of the exact balance we validated
      // against — a concurrent payment makes this match 0 rows and abort, so
      // the same debt can never be paid (or a cycle completed) twice.
      const claimed = await tx.creditAccount.updateMany({
        where: {
          id: account.id,
          status: { not: "SETTLED" },
          amountPaid: account.amountPaid,
        },
        data: { amountPaid: newPaid, status },
      });
      if (claimed.count === 0) {
        throw new Error(
          "This account changed while you were recording — refresh and try again.",
        );
      }
      const receiving = await resolveReceivingAccount(
        tx,
        parsed.data.paymentAccountId || null,
        parsed.data.method,
      );
      await tx.payment.create({
        data: {
          creditAccountId: account.id,
          amount: parsed.data.amount,
          method: receiving.method,
          paymentAccountId: receiving.paymentAccountId,
          reference: parsed.data.reference?.trim() || null,
          note: note || null,
          recordedById: admin.id,
        },
      });
      // Full repayment may close the partner's whole borrow→repay cycle:
      // score +1, and +10% limit growth when the cycle never went overdue.
      if (status === "SETTLED") {
        return completeCycleIfCleared(tx, { partnerId: account.agentId });
      }
      return null;
    });

    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "CREDIT_PAYMENT_RECORDED",
      entity: "CreditAccount",
      entityId: account.id,
      summary: `Payment of ${parsed.data.amount} recorded against ${account.request.code} (${status.toLowerCase()}).${cycleMsg ? ` ${cycleMsg}` : ""}`,
      meta: { amount: parsed.data.amount, status },
    });

    revalidateCredit();
    return ok(
      undefined,
      cycleMsg ??
        (status === "SETTLED"
          ? "Payment recorded — credit fully settled."
          : "Payment recorded."),
    );
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function markOverdue(accountId: string): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN", "FINANCE"]);
    const a = await prisma.creditAccount.findUnique({
      where: { id: accountId },
      include: { request: true },
    });
    if (!a) return fail("Credit account not found.");
    if (a.status === "SETTLED") return fail("This credit is already settled.");
    if (a.status === "OVERDUE") return fail("Already marked overdue.");
    await prisma.creditAccount.update({
      where: { id: a.id },
      // wentOverdue is sticky — it permanently marks this cycle as late, so
      // automatic limit growth is withheld even after full repayment.
      data: { status: "OVERDUE", wentOverdue: true },
    });
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "CREDIT_MARKED_OVERDUE",
      entity: "CreditAccount",
      entityId: a.id,
      summary: `Credit ${a.request.code} flagged overdue.`,
    });
    revalidateCredit();
    return ok(undefined, "Marked overdue.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function closeCredit(accountId: string): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN", "FINANCE"]);
    const a = await prisma.creditAccount.findUnique({
      where: { id: accountId },
      include: { request: true },
    });
    if (!a) return fail("Credit account not found.");
    if (a.status === "SETTLED") return fail("This credit is already closed.");
    const writeOff = Math.max(0, a.principal - a.amountPaid);
    await prisma.creditAccount.update({
      where: { id: a.id },
      data: { status: "SETTLED" },
    });
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "CREDIT_CLOSED",
      entity: "CreditAccount",
      entityId: a.id,
      summary:
        writeOff > 0
          ? `Credit ${a.request.code} force-closed — ${writeOff} written off.`
          : `Credit ${a.request.code} closed.`,
      meta: { writeOff },
    });
    revalidateCredit();
    return ok(
      undefined,
      writeOff > 0 ? `Closed — ${writeOff} written off.` : "Credit closed.",
    );
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function sendCreditReminder(
  accountId: string,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN", "FINANCE"]);
    const a = await prisma.creditAccount.findUnique({
      where: { id: accountId },
      include: { request: true, agent: { select: { name: true } } },
    });
    if (!a) return fail("Credit account not found.");
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "CREDIT_REMINDER_SENT",
      entity: "CreditAccount",
      entityId: a.id,
      summary: `Payment reminder logged for ${a.agent.name} on ${a.request.code}.`,
    });
    revalidateCredit();
    return ok(undefined, `Reminder logged for ${a.agent.name}.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const termsSchema = z.object({
  accountId: z.string().min(1),
  dueDate: z.string().min(1),
});

export async function editCreditTerms(
  input: z.infer<typeof termsSchema>,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN", "FINANCE"]);
    const parsed = termsSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid terms.");
    const a = await prisma.creditAccount.findUnique({
      where: { id: parsed.data.accountId },
      include: { request: true },
    });
    if (!a) return fail("Credit account not found.");
    const due = new Date(parsed.data.dueDate);
    if (Number.isNaN(due.getTime())) return fail("Invalid due date.");
    await prisma.creditAccount.update({
      where: { id: a.id },
      data: { dueDate: due },
    });
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "CREDIT_TERMS_UPDATED",
      entity: "CreditAccount",
      entityId: a.id,
      summary: `Due date for ${a.request.code} updated to ${due.toDateString()}.`,
    });
    revalidateCredit();
    return ok(undefined, "Terms updated.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}
