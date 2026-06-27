import { Coins, Droplets, Clock } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { DonationManager } from "@/components/admin/donation-manager";
import { formatCurrency, formatNumber } from "@/lib/utils";

export default async function AdminDonationsPage() {
  const [donations, moneyAgg, padsAgg, pendingCount] = await Promise.all([
    prisma.donation.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.donation.aggregate({ _sum: { amount: true }, where: { type: "MONEY" } }),
    prisma.donation.aggregate({
      _sum: { quantity: true },
      where: { type: "PADS" },
    }),
    prisma.donation.count({ where: { status: "PENDING" } }),
  ]);

  const dto = donations.map((d) => ({
    id: d.id,
    code: d.code,
    type: d.type,
    donorName: d.donorName,
    donorEmail: d.donorEmail,
    amount: d.amount,
    quantity: d.quantity,
    status: d.status,
    message: d.message,
    allocationNote: d.allocationNote,
    distributedTo: d.distributedTo,
    createdAt: d.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Donations"
        description="Track every gift from pledge to distribution."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Funds donated"
          value={formatCurrency(moneyAgg._sum.amount ?? 0)}
          icon={Coins}
        />
        <StatCard
          label="Pads donated"
          value={formatNumber(padsAgg._sum.quantity ?? 0)}
          icon={Droplets}
          accent="accent"
        />
        <StatCard
          label="Pending"
          value={formatNumber(pendingCount)}
          icon={Clock}
          accent="warning"
        />
      </div>
      <DonationManager donations={dto} />
    </div>
  );
}
