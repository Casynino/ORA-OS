import { prisma } from "@/lib/db";
import { getStockTotals } from "@/lib/services/inventory";

/**
 * Launch baselines so the public impact wall reflects Ora's cumulative reach,
 * not just data created in this environment. Tune as real figures grow.
 */
const IMPACT_BASELINE = {
  // Money donated now reflects REAL donations only (no baseline) — live
  // donation payments will be integrated soon.
  money: 0,
  pads: 6_000,
  girls: 5_200,
  communities: 42,
};

/** Headline figures for the public landing page + live impact wall. */
export async function getPublicImpactStats() {
  const [stock, donatedPads, donatedMoney, partners, stories, articles] =
    await Promise.all([
      getStockTotals(),
      prisma.donation.aggregate({
        _sum: { quantity: true },
        where: { type: "PADS" },
      }),
      prisma.donation.aggregate({
        _sum: { amount: true },
        where: { type: "MONEY" },
      }),
      prisma.user.count({ where: { role: "PARTNER", status: "ACTIVE" } }),
      prisma.impactStory.aggregate({
        _sum: { livesReached: true, padsDistributed: true },
        where: { published: true },
      }),
      prisma.educationContent.count({ where: { published: true } }),
    ]);

  const padsDistributed =
    stock.distributed +
    (stories._sum.padsDistributed ?? 0) +
    IMPACT_BASELINE.pads;
  const moneyDonated = (donatedMoney._sum.amount ?? 0) + IMPACT_BASELINE.money;
  const girlsReached = (stories._sum.livesReached ?? 0) + IMPACT_BASELINE.girls;

  return {
    padsDistributed,
    livesReached: girlsReached,
    girlsReached,
    moneyDonated,
    communities: IMPACT_BASELINE.communities,
    partners,
    articles,
    pledgedPads: donatedPads._sum.quantity ?? 0,
  };
}

/** Aggregated counters for the admin overview dashboard. */
export async function getAdminOverview() {
  const [
    stock,
    pendingRequests,
    activeOrders,
    pendingReturns,
    pendingDonations,
    outstandingCredit,
    agents,
    pendingAgents,
    lowStock,
  ] = await Promise.all([
    getStockTotals(),
    prisma.request.count({ where: { status: "PENDING" } }),
    prisma.request.count({ where: { status: { in: ["APPROVED", "IN_TRANSIT"] } } }),
    prisma.returnRequest.count({ where: { status: "PENDING" } }),
    prisma.donation.count({ where: { status: "PENDING" } }),
    prisma.creditAccount.aggregate({
      _sum: { principal: true, amountPaid: true },
      where: { status: { in: ["OUTSTANDING", "PARTIAL", "OVERDUE"] } },
    }),
    prisma.user.count({ where: { role: "PARTNER" } }),
    prisma.user.count({ where: { role: "PARTNER", status: "PENDING" } }),
    prisma.inventory.count({
      where: {
        warehouseQty: { lte: 50 },
      },
    }),
  ]);

  const creditOutstanding =
    (outstandingCredit._sum.principal ?? 0) -
    (outstandingCredit._sum.amountPaid ?? 0);

  return {
    stock,
    pendingRequests,
    activeOrders,
    pendingReturns,
    pendingDonations,
    creditOutstanding,
    agents,
    pendingAgents,
    lowStock,
  };
}
