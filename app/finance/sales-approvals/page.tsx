import Link from "next/link";
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
  RevertApprovalButton,
} from "@/components/finance/sales-approval-actions";
import { cn, formatCurrency, formatNumber, timeAgo } from "@/lib/utils";
import type { FinanceApproval } from "@prisma/client";

export const dynamic = "force-dynamic";

/** A cash-type sale the customer actually paid straight into a bank/Lipa
 * account or by cheque (not physical cash) — finance verifies the uploaded
 * proof; physical cash instead goes to Cash on Hand when confirmed. */
function isDirectPayment(method: string | null): boolean {
  return !!method && /bank|mobile|lipa|transfer|cheque|chek|m-?pesa|tigo|airtel|voda|halo|nmb/i.test(method);
}

// Finance acts on rep records; a record is PENDING → APPROVED / REJECTED. The
// default view is the actionable queue (everything still pending), newest
// first, so fresh requests are never buried under old ones.
const FILTERS = [
  { key: "new", label: "New requests" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];
const STATUS_FOR: Record<Exclude<FilterKey, "all">, FinanceApproval> = {
  new: "PENDING",
  approved: "APPROVED",
  rejected: "REJECTED",
};

/**
 * Finance verification queue — no rep-recorded shilling becomes official
 * company money until it's confirmed here. Filterable by status; opens on the
 * new/pending queue with the newest requests on top.
 */
export default async function FinanceSalesApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireRole("FINANCE");
  const { status: raw = "new" } = await searchParams;
  const filter = (FILTERS.some((f) => f.key === raw) ? raw : "new") as FilterKey;
  const statusWhere =
    filter === "all" ? {} : { financeStatus: STATUS_FOR[filter] };
  const listLimit = filter === "new" ? 200 : 60;

  const [
    sales,
    collections,
    pendingSaleGroups,
    pendingCollAgg,
    recentReviewed,
  ] = await Promise.all([
    prisma.fieldSale.findMany({
      where: { voided: false, ...statusWhere },
      orderBy: { createdAt: "desc" }, // newest first — the whole point
      take: listLimit,
      include: {
        rep: { select: { name: true } },
        customer: { select: { id: true, name: true, businessName: true, creditSuspended: true } },
        paymentAccount: { select: { id: true, name: true, accountNumber: true } },
        financeReviewedBy: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
    }),
    prisma.fieldPayment.findMany({
      where: { sale: { voided: false }, ...statusWhere },
      orderBy: { createdAt: "desc" },
      take: listLimit,
      include: {
        recordedBy: { select: { name: true } },
        financeReviewedBy: { select: { name: true } },
        paymentAccount: { select: { id: true, name: true, accountNumber: true } },
        sale: {
          include: {
            rep: { select: { name: true } },
            customer: { select: { name: true } },
          },
        },
      },
    }),
    // Always-on "needs action" counts for the KPI cards, independent of filter.
    prisma.fieldSale.groupBy({
      by: ["type"],
      where: { financeStatus: "PENDING", voided: false },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.fieldPayment.aggregate({
      where: { financeStatus: "PENDING", sale: { voided: false } },
      _count: true,
      _sum: { amount: true },
    }),
    filter === "new"
      ? prisma.fieldSale.findMany({
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
        })
      : Promise.resolve([]),
  ]);

  const cashGroup = pendingSaleGroups.find((g) => g.type === "CASH");
  const creditGroup = pendingSaleGroups.find((g) => g.type === "CREDIT");
  const cashPendingCount = cashGroup?._count._all ?? 0;
  const creditPendingCount = creditGroup?._count._all ?? 0;
  const collPendingCount = pendingCollAgg._count;
  const totalPending = cashPendingCount + creditPendingCount + collPendingCount;

  const cashSales = sales.filter((s) => s.type === "CASH");
  const creditSales = sales.filter((s) => s.type === "CREDIT");

  // Credit context: each customer's existing outstanding across their already
  // APPROVED credit sales — so finance sees total exposure before approving.
  const creditCustomerIds = [
    ...new Set(creditSales.map((s) => s.customer?.id).filter(Boolean)),
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

  const reviewedTag = (s: {
    financeStatus: FinanceApproval;
    financeReviewedBy: { name: string } | null;
    financeReviewedAt: Date | null;
  }) => (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <Badge variant={s.financeStatus === "APPROVED" ? "success" : "destructive"}>
        {s.financeStatus.toLowerCase()}
      </Badge>
      {s.financeReviewedBy && (
        <span className="text-[11px] text-muted-foreground">
          {s.financeReviewedBy.name}
          {s.financeReviewedAt ? ` · ${timeAgo(s.financeReviewedAt)}` : ""}
        </span>
      )}
    </div>
  );

  const saleCard = (s: (typeof sales)[number]) => (
    <div
      key={s.id}
      className={cn(
        "rounded-2xl border p-4",
        s.financeStatus !== "PENDING"
          ? "border-border bg-card"
          : s.type === "CASH"
            ? "border-warning/30 bg-warning/[0.04]"
            : "border-info/30 bg-info/[0.04]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {s.customer?.name ?? s.customerName ?? "Walk-in customer"}
            <Badge variant={s.type === "CASH" ? "success" : "accent"}>{s.type}</Badge>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {s.code} · rep {s.rep.name} · {timeAgo(s.createdAt)}
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
              {s.financeStatus === "PENDING" && isDirectPayment(s.paymentMethod) && (
                <p className="mt-1 text-xs font-medium text-warning">
                  Direct {s.paymentMethod} payment — verify the proof reached ORA&apos;s account before confirming.
                </p>
              )}
              {s.paymentProofUrl ? (
                <div className="mt-2 rounded-lg border border-border bg-muted/30 p-2">
                  <ProofViewer url={s.paymentProofUrl} label="View payment proof" compact />
                </div>
              ) : (
                s.financeStatus === "PENDING" &&
                isDirectPayment(s.paymentMethod) && (
                  <p className="mt-1 text-xs text-destructive">No proof image attached by the rep.</p>
                )
              )}
            </>
          ) : (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                Due {s.dueDate ? new Date(s.dueDate).toLocaleDateString("en-GB") : "—"}
                {s.financeStatus === "PENDING" ? " · verify the customer & terms before approving" : ""}
              </p>
              {s.financeStatus === "PENDING" && (
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
              )}
            </>
          )}
          {s.financeNote && s.financeStatus !== "PENDING" && (
            <p className="mt-1 text-xs text-muted-foreground">“{s.financeNote}”</p>
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
        {s.financeStatus === "PENDING" ? (
          <SaleApprovalActions
            saleId={s.id}
            kind={s.type as "CASH" | "CREDIT"}
            method={s.paymentMethod}
          />
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            {reviewedTag(s)}
            {/* Undo an accidental confirmation → back to the pending queue. Not for
                head-office direct sales (void those) or already-banked cash. */}
            {s.financeStatus === "APPROVED" && !s.directSale && s.cashStatus !== "DEPOSITED" && (
              <RevertApprovalButton saleId={s.id} saleCode={s.code} />
            )}
          </div>
        )}
      </div>
    </div>
  );

  const heading = (icon: React.ReactNode, label: string, count: number) => (
    <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
      {icon} {label}
      <span className="text-sm font-normal text-muted-foreground">({formatNumber(count)})</span>
    </h2>
  );
  const emptyFor =
    filter === "new"
      ? "Nothing pending here."
      : filter === "approved"
        ? "No approved records in this view."
        : filter === "rejected"
          ? "No rejected records in this view."
          : "Nothing here yet.";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales approvals"
        description="Verify each rep-recorded transaction — nothing becomes official revenue or receivables until you confirm it. New requests show first."
      />

      {/* Filters — default to the actionable queue */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          const badge = f.key === "new" && totalPending > 0 ? totalPending : null;
          return (
            <Link
              key={f.key}
              href={`/finance/sales-approvals${f.key === "new" ? "" : `?status=${f.key}`}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
              {badge !== null && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs font-semibold",
                    active ? "bg-primary-foreground/20" : "bg-warning/15 text-warning",
                  )}
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Always-on "needs action" KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Cash sales to verify"
          value={formatNumber(cashPendingCount)}
          hint={formatCurrency(cashGroup?._sum.total ?? 0)}
          icon={Banknote}
          accent={cashPendingCount > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Credit sales to review"
          value={formatNumber(creditPendingCount)}
          hint={formatCurrency(creditGroup?._sum.total ?? 0)}
          icon={CreditCard}
          accent={creditPendingCount > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Collections to verify"
          value={formatNumber(collPendingCount)}
          hint={formatCurrency(pendingCollAgg._sum.amount ?? 0)}
          icon={ClipboardCheck}
          accent={collPendingCount > 0 ? "warning" : "success"}
        />
      </div>

      {/* Cash sales */}
      <section>
        {heading(<Banknote className="size-5 text-warning" />, "Cash sales", cashSales.length)}
        {cashSales.length === 0 ? (
          <EmptyState icon={CheckCircle2} title={emptyFor} description="Rep cash sales appear here for confirmation." />
        ) : (
          <div className="space-y-2">{cashSales.map(saleCard)}</div>
        )}
      </section>

      {/* Credit sales */}
      <section>
        {heading(<CreditCard className="size-5 text-info" />, "Credit sales", creditSales.length)}
        {creditSales.length === 0 ? (
          <EmptyState icon={CheckCircle2} title={emptyFor} description="Rep credit sales appear here before they become receivables." />
        ) : (
          <div className="space-y-2">{creditSales.map(saleCard)}</div>
        )}
      </section>

      {/* Collections */}
      <section>
        {heading(<ClipboardCheck className="size-5 text-primary" />, "Collections", collections.length)}
        {collections.length === 0 ? (
          <EmptyState icon={CheckCircle2} title={emptyFor} description="Rep-collected repayments appear here before they reduce customer balances." />
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
                    {p.chequeBank && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Cheque · {p.chequeBank} · {p.chequeNumber}
                        {p.chequeDate ? ` · ${new Date(p.chequeDate).toLocaleDateString("en-GB")}` : ""}
                      </p>
                    )}
                    {p.note && (
                      <p className="mt-2 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-xs italic text-muted-foreground">
                        &ldquo;{p.note}&rdquo;
                      </p>
                    )}
                    {p.paymentProofUrl && (
                      <div className="mt-2 rounded-lg border border-border bg-muted/30 p-2">
                        <ProofViewer url={p.paymentProofUrl} label="View payment proof" compact />
                      </div>
                    )}
                  </div>
                  {p.financeStatus !== "PENDING" ? (
                    reviewedTag(p)
                  ) : p.sale.financeStatus !== "APPROVED" ? (
                    // A collection can't post onto a sale finance hasn't confirmed
                    // (approveFieldCollection rejects it). Say so here instead of
                    // offering a button whose only outcome is an error toast.
                    <p className="max-w-[13rem] shrink-0 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-2 text-xs text-warning">
                      Confirm credit sale <span className="font-semibold">{p.sale.code}</span> above
                      first — then this payment can be posted.
                    </p>
                  ) : (
                    <CollectionApprovalActions paymentId={p.id} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recently reviewed — only on the default queue, as a quick glance back */}
      {filter === "new" && recentReviewed.length > 0 && (
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
                    {/* Say WHAT the figure is. On a credit sale this is the value of
                        goods taken on credit — approving it creates the debt, it is
                        not money received — which reads as cash without this label. */}
                    <span className="text-right">
                      <span className="font-semibold">{formatCurrency(s.total)}</span>
                      <span className="block text-[11px] font-normal text-muted-foreground">
                        {s.type === "CREDIT" ? "credit sale · debt created" : "cash received"}
                      </span>
                    </span>
                    <Badge variant={s.financeStatus === "APPROVED" ? "success" : "destructive"}>
                      {s.financeStatus.toLowerCase()}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {s.financeReviewedBy?.name ?? ""} {s.financeReviewedAt ? timeAgo(s.financeReviewedAt) : ""}
                    </span>
                    {/* Just confirmed something by mistake? Undo it right here. */}
                    {s.financeStatus === "APPROVED" && !s.directSale && s.cashStatus !== "DEPOSITED" && (
                      <RevertApprovalButton saleId={s.id} saleCode={s.code} />
                    )}
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
