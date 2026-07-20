import { Banknote, CreditCard, ClipboardCheck, CheckCircle2 } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ProofViewer } from "@/components/ui/proof-viewer";
import {
  SaleApprovalActions,
  CollectionApprovalActions,
} from "@/components/finance/sales-approval-actions";
import { cn, formatCurrency, formatNumber, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

function isDirectPayment(method: string | null): boolean {
  return !!method && /bank|mobile|lipa|transfer|cheque|chek|m-?pesa|tigo|airtel|voda|halo|nmb/i.test(method);
}

/**
 * The CEO's own verification queue — the same rep-recorded money Finance confirms,
 * surfaced here so the admin can see AND act on it directly (the approval actions
 * already permit ADMIN). Pending items only; nothing here is company money until
 * confirmed. Finance still owns the day-to-day; this is the CEO's override view.
 */
export default async function AdminSalesApprovalsPage() {
  await requireRole("ADMIN");

  const [sales, collections] = await Promise.all([
    prisma.fieldSale.findMany({
      where: { voided: false, financeStatus: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        rep: { select: { name: true } },
        customer: { select: { id: true, name: true, businessName: true, creditSuspended: true } },
        paymentAccount: { select: { name: true, accountNumber: true } },
        items: { include: { product: { select: { name: true } } } },
      },
    }),
    prisma.fieldPayment.findMany({
      where: { sale: { voided: false }, financeStatus: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        recordedBy: { select: { name: true } },
        paymentAccount: { select: { name: true } },
        sale: { include: { rep: { select: { name: true } }, customer: { select: { name: true } } } },
      },
    }),
  ]);

  const cashSales = sales.filter((s) => s.type === "CASH");
  const creditSales = sales.filter((s) => s.type === "CREDIT");
  const cashTotal = cashSales.reduce((a, s) => a + s.total, 0);
  const creditTotal = creditSales.reduce((a, s) => a + s.total, 0);
  const collTotal = collections.reduce((a, p) => a + p.amount, 0);

  const saleCard = (s: (typeof sales)[number]) => (
    <div
      key={s.id}
      className={cn(
        "rounded-2xl border p-4",
        s.type === "CASH" ? "border-warning/30 bg-warning/[0.04]" : "border-info/30 bg-info/[0.04]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {s.customer?.businessName ?? s.customer?.name ?? s.customerName ?? "Walk-in customer"}
            <Badge variant={s.type === "CASH" ? "success" : "accent"}>{s.type}</Badge>
            {s.customer?.creditSuspended && <Badge variant="destructive" className="text-[10px]">credit suspended</Badge>}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {s.code} · rep {s.rep.name} · {timeAgo(s.createdAt)}
          </p>
          <p className="mt-1.5 font-display text-xl font-bold">{formatCurrency(s.total)}</p>
          {s.type === "CASH" ? (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                Declared: {s.paymentMethod ?? "—"}
                {s.paymentAccount ? ` → ${s.paymentAccount.name}${s.paymentAccount.accountNumber ? ` · ${s.paymentAccount.accountNumber}` : ""}` : ""}
                {s.reference ? ` · ref ${s.reference}` : ""}
              </p>
              {isDirectPayment(s.paymentMethod) && (
                <p className="mt-1 text-xs font-medium text-warning">
                  Direct {s.paymentMethod} payment — verify the proof reached ORA&apos;s account before confirming.
                </p>
              )}
              {s.paymentProofUrl ? (
                <div className="mt-2 rounded-lg border border-border bg-muted/30 p-2">
                  <ProofViewer url={s.paymentProofUrl} label="View payment proof" compact />
                </div>
              ) : (
                isDirectPayment(s.paymentMethod) && <p className="mt-1 text-xs text-destructive">No proof image attached by the rep.</p>
              )}
            </>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Due {s.dueDate ? new Date(s.dueDate).toLocaleDateString("en-GB") : "—"} · verify the customer &amp; terms before approving
            </p>
          )}
          <ul className="mt-2 space-y-0.5 border-t border-border/40 pt-2">
            {s.items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="min-w-0 truncate">
                  {i.product.name} ×{i.quantity} @ {formatCurrency(i.unitPrice)}
                  {i.defaultPrice != null && i.defaultPrice !== i.unitPrice && (
                    <span className={cn("ml-1", i.unitPrice < i.defaultPrice ? "text-warning" : "text-success")}>
                      (list {formatCurrency(i.defaultPrice)})
                    </span>
                  )}
                </span>
                <span className="shrink-0">{formatCurrency(i.lineTotal)}</span>
              </li>
            ))}
          </ul>
        </div>
        <SaleApprovalActions saleId={s.id} kind={s.type as "CASH" | "CREDIT"} method={s.paymentMethod} />
      </div>
    </div>
  );

  const heading = (icon: React.ReactNode, label: string, count: number) => (
    <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
      {icon} {label}
      <span className="text-sm font-normal text-muted-foreground">({formatNumber(count)})</span>
    </h2>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales approvals"
        description="Rep-recorded money awaiting sign-off. Finance handles these day-to-day; you can review and act on any of them directly here. Nothing is official until confirmed."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Cash sales to verify" value={formatNumber(cashSales.length)} hint={formatCurrency(cashTotal)} icon={Banknote} accent={cashSales.length > 0 ? "warning" : "success"} />
        <StatCard label="Credit sales to review" value={formatNumber(creditSales.length)} hint={formatCurrency(creditTotal)} icon={CreditCard} accent={creditSales.length > 0 ? "warning" : "success"} />
        <StatCard label="Collections to verify" value={formatNumber(collections.length)} hint={formatCurrency(collTotal)} icon={ClipboardCheck} accent={collections.length > 0 ? "warning" : "success"} />
      </div>

      <section>
        {heading(<Banknote className="size-5 text-warning" />, "Cash sales", cashSales.length)}
        {cashSales.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Nothing pending" description="Rep cash sales appear here for confirmation." />
        ) : (
          <div className="space-y-2">{cashSales.map(saleCard)}</div>
        )}
      </section>

      <section>
        {heading(<CreditCard className="size-5 text-info" />, "Credit sales", creditSales.length)}
        {creditSales.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Nothing pending" description="Rep credit sales appear here before they become receivables." />
        ) : (
          <div className="space-y-2">{creditSales.map(saleCard)}</div>
        )}
      </section>

      <section>
        {heading(<ClipboardCheck className="size-5 text-primary" />, "Collections", collections.length)}
        {collections.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Nothing pending" description="Rep-collected repayments appear here before they reduce customer balances." />
        ) : (
          <div className="space-y-2">
            {collections.map((p) => (
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
                    {p.paymentProofUrl && (
                      <div className="mt-2 rounded-lg border border-border bg-muted/30 p-2">
                        <ProofViewer url={p.paymentProofUrl} label="View payment proof" compact />
                      </div>
                    )}
                  </div>
                  <CollectionApprovalActions paymentId={p.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
