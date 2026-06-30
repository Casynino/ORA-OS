import { Coins, Droplets, Clock, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { DonationManager } from "@/components/admin/donation-manager";
import { formatCurrency, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAID = ["RECEIVED", "ALLOCATED", "DISTRIBUTED"] as const;

export default async function AdminDonationsPage() {
  const [donations, moneyAgg, padsAgg, pendingCount, donorRows] =
    await Promise.all([
      prisma.donation.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.donation.aggregate({
        _sum: { amount: true },
        where: { status: { in: [...PAID] } },
      }),
      prisma.donation.aggregate({
        _sum: { quantity: true },
        where: { type: "PADS", status: { in: [...PAID] } },
      }),
      prisma.donation.count({ where: { status: "PENDING" } }),
      prisma.donation.findMany({
        where: { status: { in: [...PAID] }, donorPhone: { not: null } },
        select: { donorPhone: true },
        distinct: ["donorPhone"],
      }),
    ]);

  const dto = donations.map((d) => ({
    id: d.id,
    code: d.code,
    type: d.type,
    donorName: d.donorName,
    donorEmail: d.donorEmail,
    donorPhone: d.donorPhone,
    amount: d.amount,
    quantity: d.quantity,
    status: d.status,
    message: d.message,
    reference: d.txHash ?? d.ntzsDepositId,
    paidAt: d.paidAt ? d.paidAt.toISOString() : null,
    allocationNote: d.allocationNote,
    distributedTo: d.distributedTo,
    createdAt: d.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Donations"
        description="Every gift collected through NTZS — live."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Funds received"
          value={formatCurrency(moneyAgg._sum.amount ?? 0)}
          icon={Coins}
        />
        <StatCard
          label="Pads sponsored"
          value={formatNumber(padsAgg._sum.quantity ?? 0)}
          icon={Droplets}
          accent="accent"
        />
        <StatCard
          label="Unique donors"
          value={formatNumber(donorRows.length)}
          icon={Users}
          accent="success"
        />
        <StatCard
          label="Awaiting payment"
          value={formatNumber(pendingCount)}
          icon={Clock}
          accent="warning"
        />
      </div>
      <DonationManager donations={dto} />
    </div>
  );
}
