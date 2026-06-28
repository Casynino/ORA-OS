import { Clock, Coins, Banknote } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { PaymentQueue } from "@/components/admin/payment-queue";
import { formatCurrency, formatNumber } from "@/lib/utils";

export default async function AdminPaymentsPage() {
  await requireRole("ADMIN");

  // Cash orders that are approved but still awaiting payment confirmation.
  // These are held back from the warehouse until an admin confirms payment.
  const orders = await prisma.request.findMany({
    where: {
      status: "APPROVED",
      paymentType: "IMMEDIATE",
      paymentStatus: "UNPAID",
    },
    orderBy: { reviewedAt: "desc" },
    include: { requester: { select: { name: true, organization: true } } },
  });

  const rows = orders.map((o) => ({
    id: o.id,
    code: o.code,
    customer: o.requester.name,
    org: o.requester.organization,
    amount: o.totalAmount ?? 0,
    warehouse: o.warehouseName,
    whenISO: (o.reviewedAt ?? o.createdAt).toISOString(),
  }));
  const expected = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pending payments"
        description="Cash orders approved and awaiting payment confirmation. Nothing reaches the warehouse until you confirm payment here."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Awaiting confirmation" value={formatNumber(rows.length)} icon={Clock} accent="warning" />
        <StatCard label="Expected cash" value={formatCurrency(expected)} icon={Coins} accent="primary" />
        <StatCard label="Credit orders" value="Auto-released" icon={Banknote} accent="info" hint="released on approval" />
      </div>

      <PaymentQueue orders={rows} />
    </div>
  );
}
