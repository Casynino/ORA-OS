import { Banknote, CreditCard, ClipboardCheck, CheckCircle2 } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  SaleApprovalActions,
  CollectionApprovalActions,
} from "@/components/finance/sales-approval-actions";
import { formatCurrency, formatNumber, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** A cash-type sale the customer actually paid straight into a bank/Lipa
 * account (not physical cash) — finance verifies the uploaded proof. */
function isDirectPayment(method: string | null): boolean {
  return !!method && /bank|mobile|lipa|transfer|m-?pesa|tigo|airtel|halo/i.test(method);
}

/**
 * Finance verification queue — no rep-recorded shilling becomes official
 * company money until it's confirmed here.
 */
export default async function FinanceSalesApprovalsPage() {
  await requireRole("FINANCE");

  const [pendingSales, pendingCollections, recentReviewed, accounts] = await Promise.all([
    prisma.fieldSale.findMany({
      where: { financeStatus: "PENDING", voided: false },
      orderBy: { createdAt: "asc" },
      include: {
        rep: { select: { name: true } },
        customer: { select: { id: true, name: true, businessName: true, creditSuspended: true } },
        paymentAccount: { select: { id: true, name: true, accountNumber: true } },
        items: { include: { product: { select: { name: true } } } },
      },
    }),
    prisma.fieldPayment.findMany({
      where: { financeStatus: "PENDING", sale: { voided: false } },
      orderBy: { createdAt: "asc" },
      include: {
        recordedBy: { select: { name: true } },
        paymentAccount: { select: { id: true, name: true, accountNumber: true } },
        sale: {
          include: {
            rep: { select: { name: true } },
            customer: { select: { name: true } },
          },
        },
      },
    }),
    prisma.fieldSale.findMany({
      // Genuinely reviewed rows only — a person acted on these. Backfilled
      // auto-approvals have a null financeReviewedAt and don't belong here.
      where: {
        financeStatus: { in: ["APPROVED", "REJECTED"] },
        voided: false,
        financeReviewedAt: { not: null },
      },
      orderBy: { financeReviewedAt: "desc" },
      take: 10,
      include: {
        rep: { select: { name: true } },
        customer: { select: { name: true } },
        financeReviewedBy: { select: { name: true } },
      },
    }),
    // Company accounts finance can deposit into (the CEO owns them).
    prisma.paymentAccount.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, accountNumber: true },
    }),
  ]);

  const cashPending = pendingSales.filter((s) => s.type === "CASH");
  const creditPending = pendingSales.filter((s) => s.type === "CREDIT");

  // Credit context: each customer's existing outstanding across their already
  // APPROVED credit sales — so finance sees total exposure before approving.
  const creditCustomerIds = [
    ...new Set(creditPending.map((s) => s.customer?.id).filter(Boolean)),
  ] as string[];
  const priorCredit = creditCustomerIds.length
    ? await prisma.fieldSale.groupBy({
        by: ["customerId"],
        where: {
          customerId: { in: creditCustomerIds },
          type: "CREDIT",
          financeStatus: "APPROVED",
          voided: false,
        },
        _sum: { total: true, amountPaid: true },
      })
    : [];
  const outstandingByCustomer = new Map<string, number>();
  for (const r of priorCredit) {
    if (r.customerId) {
      outstandingByCustomer.set(
        r.customerId,
        Math.max(0, (r._sum.total ?? 0) - (r._sum.amountPaid ?? 0)),
      );
    }
  }

  const saleCard = (s: (typeof pendingSales)[number]) => (
    <div
      key={s.id}
      className={`rounded-2xl border p-4 ${
        s.type === "CASH" ? "border-warning/30 bg-warning/[0.04]" : "border-info/30 bg-info/[0.04]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {s.customer?.name ?? s.customerName ?? "Walk-in customer"}
            <Badge variant={s.type === "CASH" ? "success" : "accent"}>{s.type}</Badge>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {s.code} · rep {s.rep.name} · {timeAgo(s.createdAt)}
            {s.customer?.businessName ? ` · ${s.customer.businessName}` : ""}
          </p>
          <p className="mt-1.5 font-display text-xl font-bold">{formatCurrency(s.total)}</p>
          {s.type === "CASH" ? (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                Declared: {s.paymentMethod ?? "—"}
                {s.paymentAccount
                  ? ` → ${s.paymentAccount.name}${s.paymentAccount.accountNumber ? ` · ${s.paymentAccount.accountNumber}` : ""}`
                  : ""}
                {s.reference ? ` · ref ${s.reference}` : ""}
              </p>
              {isDirectPayment(s.paymentMethod) && (
                <p className="mt-1 text-xs font-medium text-warning">
                  Direct {s.paymentMethod} payment — verify the proof reached ORA&apos;s account before confirming.
                </p>
              )}
              {s.paymentProofUrl ? (
                <a
                  href={s.paymentProofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2 text-xs font-medium text-primary hover:bg-muted/50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.paymentProofUrl} alt="Payment proof" className="size-12 rounded object-cover" />
                  View payment proof →
                </a>
              ) : (
                isDirectPayment(s.paymentMethod) && (
                  <p className="mt-1 text-xs text-destructive">No proof image attached by the rep.</p>
                )
              )}
            </>
          ) : (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                Due {s.dueDate ? new Date(s.dueDate).toLocaleDateString("en-GB") : "—"} · verify the customer &amp; terms before approving
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                <span className="text-muted-foreground">
                  Customer owes{" "}
                  <span className="font-semibold text-foreground">
                    {formatCurrency(s.customer ? outstandingByCustomer.get(s.customer.id) ?? 0 : 0)}
                  </span>{" "}
                  now → {formatCurrency((s.customer ? outstandingByCustomer.get(s.customer.id) ?? 0 : 0) + s.total)} after this sale
                </span>
                {s.customer?.creditSuspended && (
                  <Badge variant="destructive" className="text-[10px]">credit suspended</Badge>
                )}
              </p>
            </>
          )}
          <ul className="mt-2 space-y-0.5 border-t border-border/40 pt-2">
            {s.items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="min-w-0 truncate">{i.product.name} ×{i.quantity}</span>
                <span className="shrink-0">{formatCurrency(i.lineTotal)}</span>
              </li>
            ))}
          </ul>
        </div>
        <SaleApprovalActions
          saleId={s.id}
          kind={s.type as "CASH" | "CREDIT"}
          amount={formatCurrency(s.total)}
          accounts={accounts}
          suggestedAccountId={s.paymentAccount?.id ?? null}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales approvals"
        description="Verify each rep-recorded transaction — nothing becomes official revenue or receivables until you confirm it."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Cash sales to verify"
          value={formatNumber(cashPending.length)}
          hint={formatCurrency(cashPending.reduce((s, x) => s + x.total, 0))}
          icon={Banknote}
          accent={cashPending.length > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Credit sales to review"
          value={formatNumber(creditPending.length)}
          hint={formatCurrency(creditPending.reduce((s, x) => s + x.total, 0))}
          icon={CreditCard}
          accent={creditPending.length > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Collections to verify"
          value={formatNumber(pendingCollections.length)}
          hint={formatCurrency(pendingCollections.reduce((s, x) => s + x.amount, 0))}
          icon={ClipboardCheck}
          accent={pendingCollections.length > 0 ? "warning" : "success"}
        />
      </div>

      {/* Cash sales */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
          <Banknote className="size-5 text-warning" /> Cash sales — verify the money arrived
        </h2>
        {cashPending.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Nothing to verify" description="New rep cash sales land here for confirmation." />
        ) : (
          <div className="space-y-2">{cashPending.map(saleCard)}</div>
        )}
      </section>

      {/* Credit sales */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
          <CreditCard className="size-5 text-info" /> Credit sales — validate the terms
        </h2>
        {creditPending.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Nothing to review" description="New rep credit sales land here before they become receivables." />
        ) : (
          <div className="space-y-2">{creditPending.map(saleCard)}</div>
        )}
      </section>

      {/* Collections */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
          <ClipboardCheck className="size-5 text-primary" /> Collections — verify & post to balances
        </h2>
        {pendingCollections.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Nothing to post" description="Rep-collected repayments land here before they reduce customer balances." />
        ) : (
          <div className="space-y-2">
            {pendingCollections.map((p) => (
              <div key={p.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {p.sale.customer?.name ?? p.sale.customerName ?? "Customer"} · {p.sale.code}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      submitted by {p.recordedBy.name} · {timeAgo(p.createdAt)}
                      {p.method ? ` · ${p.method}` : ""}
                      {p.paymentAccount ? ` → ${p.paymentAccount.name}` : ""}
                      {p.reference ? ` · ref ${p.reference}` : ""}
                    </p>
                    <p className="mt-1.5 font-display text-xl font-bold">{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      outstanding on sale: {formatCurrency(Math.max(0, p.sale.total - p.sale.amountPaid))}
                    </p>
                  </div>
                  <CollectionApprovalActions
                    paymentId={p.id}
                    amount={formatCurrency(p.amount)}
                    accounts={accounts}
                    suggestedAccountId={p.paymentAccount?.id ?? null}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recently reviewed */}
      {recentReviewed.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
            <CheckCircle2 className="size-5 text-success" /> Recently reviewed
          </h2>
          <div className="rounded-2xl border border-border bg-card">
            <ul className="divide-y divide-border/60">
              {recentReviewed.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium">{s.code}</span>{" "}
                    <span className="text-muted-foreground">
                      · {s.customer?.name ?? s.customerName ?? "Walk-in"} · rep {s.rep.name}
                    </span>
                    {s.financeNote && (
                      <span className="block text-xs text-muted-foreground">“{s.financeNote}”</span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-semibold">{formatCurrency(s.total)}</span>
                    <Badge variant={s.financeStatus === "APPROVED" ? "success" : "destructive"}>
                      {s.financeStatus.toLowerCase()}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {s.financeReviewedBy?.name ?? ""} {s.financeReviewedAt ? timeAgo(s.financeReviewedAt) : ""}
                    </span>
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
