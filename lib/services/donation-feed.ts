import { prisma } from "@/lib/db";
import { ntzsConfigured, ntzsGetDeposit, ntzsDepositPaid } from "@/lib/ntzs";

const PAID = ["RECEIVED", "ALLOCATED", "DISTRIBUTED"] as const;

/**
 * Confirm donations by polling NTZS — no webhook required. For every pending
 * donation that has an NTZS deposit, check whether the money has settled and,
 * if so, mark it received. Returns how many were newly confirmed.
 */
let lastReconcile = 0;

export async function reconcilePendingDonations(): Promise<number> {
  if (!ntzsConfigured()) return 0;
  // Throttle so frequent polling from many visitors can't stampede NTZS.
  const now = Date.now();
  if (now - lastReconcile < 2500) return 0;
  lastReconcile = now;
  const pending = await prisma.donation.findMany({
    where: { status: "PENDING", ntzsDepositId: { not: null } },
    select: { id: true, code: true, ntzsDepositId: true },
    take: 25,
  });
  let confirmed = 0;
  for (const d of pending) {
    try {
      const dep = await ntzsGetDeposit(d.ntzsDepositId!);
      if (ntzsDepositPaid(dep.status)) {
        await prisma.donation.update({
          where: { id: d.id },
          data: { status: "RECEIVED", paidAt: new Date(), txHash: dep.txHash ?? null },
        });
        confirmed++;
      }
    } catch {
      /* leave pending; try again on the next poll */
    }
  }
  return confirmed;
}

export type DonationFeed = {
  counters: {
    moneyRaised: number;
    padsSponsored: number;
    donations: number;
    donors: number;
  };
  recent: { id: string; name: string; amount: number | null; pads: number | null; at: string }[];
};

/** Live donation counters + the most recent confirmed gifts (first names only). */
export async function getDonationFeed(): Promise<DonationFeed> {
  const [money, pads, count, donorRows, recent] = await Promise.all([
    prisma.donation.aggregate({ _sum: { amount: true }, where: { status: { in: [...PAID] } } }),
    prisma.donation.aggregate({
      _sum: { quantity: true },
      where: { type: "PADS", status: { in: [...PAID] } },
    }),
    prisma.donation.count({ where: { status: { in: [...PAID] } } }),
    prisma.donation.findMany({
      where: { status: { in: [...PAID] }, donorPhone: { not: null } },
      select: { donorPhone: true },
      distinct: ["donorPhone"],
    }),
    prisma.donation.findMany({
      where: { status: { in: [...PAID] } },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      take: 12,
      select: { id: true, donorName: true, amount: true, quantity: true, paidAt: true, createdAt: true },
    }),
  ]);

  return {
    counters: {
      moneyRaised: money._sum.amount ?? 0,
      padsSponsored: pads._sum.quantity ?? 0,
      donations: count,
      donors: donorRows.length,
    },
    recent: recent.map((d) => ({
      id: d.id,
      // First name only — never expose the donor's full identity publicly.
      name: (d.donorName || "Someone").trim().split(/\s+/)[0],
      amount: d.amount,
      pads: d.quantity,
      at: (d.paidAt ?? d.createdAt).toISOString(),
    })),
  };
}
