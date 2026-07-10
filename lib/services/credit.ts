import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type Tx = Prisma.TransactionClient;

/** Automatic growth applied after each successfully repaid credit cycle. */
export const CYCLE_GROWTH_RATE = 0.1; // +10%

/** Request statuses that represent committed-but-not-yet-ledgered credit orders. */
const OPEN_CREDIT_ORDER_STATUSES = ["PENDING", "APPROVED", "IN_TRANSIT"] as const;

/**
 * A partner's revolving credit facility, computed live.
 * "Used" counts BOTH open credit-account balances AND credit orders still in
 * flight (their debt ledger only opens at fulfilment) — so a partner can't
 * stack several pending orders that individually fit but together exceed the
 * limit. `excludeRequestId` lets an edit/approval re-check exclude the order
 * being evaluated from its own exposure.
 */
export async function getPartnerCredit(
  partnerId: string,
  opts?: { excludeRequestId?: string },
) {
  const [me, openAccounts, openOrders] = await Promise.all([
    prisma.user.findUnique({
      where: { id: partnerId },
      select: { creditLimit: true, creditScore: true, creditCycles: true },
    }),
    prisma.creditAccount.findMany({
      where: { agentId: partnerId, status: { not: "SETTLED" } },
      select: { principal: true, amountPaid: true, status: true },
    }),
    prisma.request.aggregate({
      _sum: { totalAmount: true },
      where: {
        requesterId: partnerId,
        paymentType: "CREDIT",
        status: { in: [...OPEN_CREDIT_ORDER_STATUSES] },
        // an order with an open ledger account would be double-counted:
        creditAccount: null,
        ...(opts?.excludeRequestId ? { id: { not: opts.excludeRequestId } } : {}),
      },
    }),
  ]);
  const limit = me?.creditLimit ?? 0;
  const ledgerUsed = openAccounts.reduce(
    (s, a) => s + Math.max(0, a.principal - a.amountPaid),
    0,
  );
  const inFlight = openOrders._sum.totalAmount ?? 0;
  const used = ledgerUsed + inFlight;
  return {
    limit,
    used,
    ledgerUsed,
    inFlight,
    available: Math.max(0, limit - used),
    score: me?.creditScore ?? 0,
    cycles: me?.creditCycles ?? 0,
    hasOverdue: openAccounts.some((a) => a.status === "OVERDUE"),
  };
}

/**
 * Called inside a payment transaction AFTER the credit account has been
 * updated. If the partner's entire outstanding balance just reached zero, the
 * borrow→repay cycle is complete: bump the credit score + cycle count, and —
 * when NO account settled during this cycle ever went overdue — grow the
 * limit by 10%. (The sticky `wentOverdue` flag means neither a token partial
 * payment nor a favourable repayment order can game the growth.)
 *
 * Returns a short human message when a cycle completed (for the toast), else null.
 * Force-closures/write-offs must NOT call this — written-off debt is not repayment.
 */
export async function completeCycleIfCleared(
  tx: Tx,
  { partnerId }: { partnerId: string },
): Promise<string | null> {
  // Any balance still open (this payment's account already updated)?
  const stillOpen = await tx.creditAccount.count({
    where: { agentId: partnerId, status: { not: "SETTLED" } },
  });
  if (stillOpen > 0) return null;

  const partner = await tx.user.findUnique({
    where: { id: partnerId },
    select: { creditLimit: true, creditScore: true, creditCycles: true, name: true },
  });
  if (!partner) return null;

  // Did any account settled within THIS cycle (i.e. touched since the last
  // completed cycle) ever go overdue? If so, the cycle finishes without growth.
  const lastCycle = await tx.partnerCreditEvent.findFirst({
    where: { partnerId, type: "CYCLE_COMPLETED" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const dirty = await tx.creditAccount.count({
    where: {
      agentId: partnerId,
      wentOverdue: true,
      updatedAt: { gt: lastCycle?.createdAt ?? new Date(0) },
    },
  });
  const wasOverdue = dirty > 0;

  const prevLimit = partner.creditLimit ?? 0;
  const cycles = partner.creditCycles + 1;
  const score = partner.creditScore + 1;
  const grow = !wasOverdue && prevLimit > 0;
  const newLimit = grow ? Math.round(prevLimit * (1 + CYCLE_GROWTH_RATE)) : prevLimit;

  await tx.user.update({
    where: { id: partnerId },
    data: { creditScore: score, creditCycles: cycles, creditLimit: newLimit },
  });
  await tx.partnerCreditEvent.create({
    data: {
      partnerId,
      type: "CYCLE_COMPLETED",
      prevLimit,
      newLimit: prevLimit, // the cycle itself doesn't change the limit
      score,
      cycles,
      note: wasOverdue
        ? `Cycle ${cycles} repaid in full (went overdue — no automatic increase).`
        : `Cycle ${cycles} repaid in full and on time.`,
    },
  });
  if (grow) {
    await tx.partnerCreditEvent.create({
      data: {
        partnerId,
        type: "LIMIT_INCREASE",
        prevLimit,
        newLimit,
        score,
        cycles,
        note: `Automatic +10% growth after cycle ${cycles}.`,
      },
    });
  }

  return grow
    ? `Credit cycle complete — ${partner.name}'s limit grew 10% to ${newLimit.toLocaleString()} TSh.`
    : `Credit cycle complete — balance fully repaid.`;
}

/** Record an admin-made limit change in the audit history. */
export async function recordLimitSet(
  tx: Tx,
  {
    partnerId,
    prevLimit,
    newLimit,
    note,
  }: { partnerId: string; prevLimit: number; newLimit: number; note?: string },
) {
  if (prevLimit === newLimit) return;
  const partner = await tx.user.findUnique({
    where: { id: partnerId },
    select: { creditScore: true, creditCycles: true },
  });
  await tx.partnerCreditEvent.create({
    data: {
      partnerId,
      type: "LIMIT_SET",
      prevLimit,
      newLimit,
      score: partner?.creditScore ?? 0,
      cycles: partner?.creditCycles ?? 0,
      note: note ?? "Limit set by the ORA team.",
    },
  });
}
