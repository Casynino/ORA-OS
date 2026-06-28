import { Clock, Coins, HandCoins } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { PaymentQueue } from "@/components/admin/payment-queue";
import { SettlementQueue } from "@/components/admin/settlement-queue";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckCircle2 } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";

// The payment queues must always reflect the live order/settlement state.
export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  await requireRole("ADMIN");

  const [cashOrders, settlementRows] = await Promise.all([
    // Cash orders approved but awaiting payment confirmation (held from warehouse).
    prisma.request.findMany({
      where: { status: "APPROVED", paymentType: "IMMEDIATE", paymentStatus: "UNPAID" },
      // Customer-confirmed payments first (they need verifying), then by recency.
      orderBy: [{ paymentClaimedAt: "desc" }, { reviewedAt: "desc" }],
      include: { requester: { select: { name: true, organization: true } } },
    }),
    // Partner-submitted credit repayments awaiting confirmation.
    prisma.settlementRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: {
        partner: { select: { name: true } },
        creditAccount: { include: { request: { select: { code: true } } } },
      },
    }),
  ]);

  const orders = cashOrders.map((o) => ({
    id: o.id,
    code: o.code,
    customer: o.requester.name,
    org: o.requester.organization,
    amount: o.totalAmount ?? 0,
    warehouse: o.warehouseName,
    whenISO: (o.reviewedAt ?? o.createdAt).toISOString(),
    claimedISO: o.paymentClaimedAt ? o.paymentClaimedAt.toISOString() : null,
  }));
  const settlements = settlementRows.map((s) => ({
    id: s.id,
    code: s.code,
    partner: s.partner.name,
    batchCode: s.creditAccount.request.code,
    amount: s.amount,
    method: s.method,
    reference: s.reference,
    whenISO: s.createdAt.toISOString(),
  }));

  const expectedCash = orders.reduce((s, r) => s + r.amount, 0);
  const repayTotal = settlements.reduce((s, r) => s + r.amount, 0);
  const totalToConfirm = orders.length + settlements.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Confirm money coming into ORA — cash on new orders and partner credit repayments. Nothing reaches the warehouse, and no repayment posts to a ledger, until you confirm it here."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="To confirm" value={formatNumber(totalToConfirm)} icon={Clock} accent="warning" hint={`${orders.length} orders · ${settlements.length} repayments`} />
        <StatCard label="Expected cash (orders)" value={formatCurrency(expectedCash)} icon={Coins} accent="primary" />
        <StatCard label="Repayments pending" value={formatCurrency(repayTotal)} icon={HandCoins} accent="info" />
      </div>

      {totalToConfirm === 0 ? (
        <EmptyState
          className="glass-card rounded-2xl py-12"
          icon={CheckCircle2}
          title="All caught up"
          description="No payments are waiting to be confirmed right now."
        />
      ) : (
        <>
          {orders.length > 0 && (
            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cash order payments · {orders.length}
              </p>
              <PaymentQueue orders={orders} />
            </section>
          )}

          {settlements.length > 0 && (
            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Partner credit repayments · {settlements.length}
              </p>
              <SettlementQueue rows={settlements} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
