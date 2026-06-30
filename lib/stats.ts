import { prisma } from "@/lib/db";
import { getStockTotals } from "@/lib/services/inventory";

// Only confirmed-paid donations count toward any public figure.
const PAID_DONATION = ["RECEIVED", "ALLOCATED", "DISTRIBUTED"] as const;

/** Headline figures for the public landing page + live impact wall.
 * Every number is derived from real data — no baselines or placeholders. */
export async function getPublicImpactStats() {
  const [stock, donatedPads, donatedMoney, partners, stories, articles, communityRows] =
    await Promise.all([
      getStockTotals(),
      prisma.donation.aggregate({
        _sum: { quantity: true },
        where: { type: "PADS", status: { in: [...PAID_DONATION] } },
      }),
      prisma.donation.aggregate({
        _sum: { amount: true },
        // Only money that's actually been received counts as "raised".
        where: { status: { in: [...PAID_DONATION] } },
      }),
      prisma.user.count({ where: { role: "PARTNER", status: "ACTIVE" } }),
      prisma.impactStory.aggregate({
        _sum: { livesReached: true, padsDistributed: true },
        where: { published: true },
      }),
      prisma.educationContent.count({ where: { published: true } }),
      prisma.donation.findMany({
        where: { distributedTo: { not: null } },
        select: { distributedTo: true },
        distinct: ["distributedTo"],
      }),
    ]);

  const padsDistributed = stock.distributed + (stories._sum.padsDistributed ?? 0);
  const moneyDonated = donatedMoney._sum.amount ?? 0;
  const girlsReached = stories._sum.livesReached ?? 0;

  return {
    padsDistributed,
    livesReached: girlsReached,
    girlsReached,
    moneyDonated,
    communities: communityRows.length,
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
