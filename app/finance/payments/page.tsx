import { ClipboardCheck, CheckCircle2, Clock } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { OrderPaymentConfirm } from "@/components/finance/order-payment-confirm";
import { formatCurrency, formatNumber, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Finance owns payment confirmation: verify the customer's money actually
 * landed in a company account, confirm it, and the order releases to the
 * warehouse automatically.
 */
export default async function FinancePaymentsPage() {
  await requireRole("FINANCE");

  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);

  const [pending, accounts, confirmedToday] = await Promise.all([
    prisma.request.findMany({
      where: {
        status: "APPROVED",
        paymentType: "IMMEDIATE",
        paymentStatus: "UNPAID",
      },
      orderBy: [{ paymentClaimedAt: { sort: "desc", nulls: "last" } }, { createdAt: "asc" }],
      include: {
        requester: { select: { name: true, organization: true } },
        items: { select: { quantity: true } },
      },
    }),
    prisma.paymentAccount.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, accountName: true, accountNumber: true },
    }),
    prisma.request.findMany({
      where: { paymentStatus: "PAID", paidAt: { gte: startToday } },
      orderBy: { paidAt: "desc" },
      take: 10,
      include: { requester: { select: { name: true } } },
    }),
  ]);

  const claimed = pending.filter((p) => p.paymentClaimedAt);
  const pendingValue = pending.reduce((s, p) => s + (p.totalAmount ?? 0), 0);
  const confirmedTodayValue = confirmedToday.reduce((s, p) => s + (p.totalAmount ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment confirmations"
        description="Verify each incoming payment against the receiving account, then confirm — the order moves to the warehouse automatically."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Awaiting confirmation" value={formatNumber(pending.length)} hint={formatCurrency(pendingValue)} icon={ClipboardCheck} accent={pending.length > 0 ? "warning" : "success"} />
        <StatCard label="Claimed by customers" value={formatNumber(claimed.length)} hint="customer says they've paid" icon={Clock} accent={claimed.length > 0 ? "info" : "success"} />
        <StatCard label="Confirmed today" value={formatNumber(confirmedToday.length)} hint={formatCurrency(confirmedTodayValue)} icon={CheckCircle2} accent="success" />
      </div>

      {/* Queue */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
          <ClipboardCheck className="size-5 text-warning" />
          Awaiting your confirmation
        </h2>
        {pending.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="All payments confirmed"
            description="Cash orders waiting for payment verification will appear here."
          />
        ) : (
          <div className="space-y-2">
            {pending.map((r) => (
              <div
                key={r.id}
                className={`rounded-2xl border p-4 ${
                  r.paymentClaimedAt
                    ? "border-info/40 bg-info/[0.05]"
                    : "border-warning/30 bg-warning/[0.04]"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      {r.requester.organization ?? r.requester.name}
                      {r.paymentClaimedAt ? (
                        <Badge variant="info">customer says paid {timeAgo(r.paymentClaimedAt)}</Badge>
                      ) : (
                        <Badge variant="warning">awaiting payment</Badge>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.code}
                      {r.invoiceNo ? ` · Invoice ${r.invoiceNo}` : ""} ·{" "}
                      {formatNumber(r.items.reduce((s, i) => s + i.quantity, 0))} units · ordered {timeAgo(r.createdAt)}
                    </p>
                    <p className="mt-1.5 font-display text-xl font-bold">
                      {formatCurrency(r.totalAmount ?? 0)}
                    </p>
                  </div>
                  <OrderPaymentConfirm requestId={r.id} accounts={accounts} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Confirmed today */}
      {confirmedToday.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
            <CheckCircle2 className="size-5 text-success" />
            Confirmed today
          </h2>
          <div className="rounded-2xl border border-border bg-card">
            <ul className="divide-y divide-border/60">
              {confirmedToday.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium">{r.requester.name}</span>{" "}
                    <span className="text-muted-foreground">· {r.code}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {r.paymentMethod && <Badge variant="secondary">{r.paymentMethod}</Badge>}
                    <span className="font-semibold text-success">{formatCurrency(r.totalAmount ?? 0)}</span>
                    <span className="text-xs text-muted-foreground">{r.paidAt ? timeAgo(r.paidAt) : ""}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
