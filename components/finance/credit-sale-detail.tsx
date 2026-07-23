import Link from "next/link";
import {
  ArrowLeft,
  Phone,
  MapPin,
  BadgeCheck,
  Wallet,
  Banknote,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProofViewer } from "@/components/ui/proof-viewer";
import { FieldCollectionButton } from "@/components/finance/field-collection-button";
import type {
  CreditSaleDetailDTO,
  ReceivingAcct,
} from "@/lib/services/credit-sale-detail";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "@/lib/utils";

const DAY = 24 * 60 * 60 * 1000;

/** Full detail of one customer debt — collected so far, payment history with
 *  proofs, days to due, and (while owing) a Record-payment action. Shared by
 *  the finance and admin debt-detail pages. */
export function CreditSaleDetail({
  sale,
  accounts,
  backHref,
}: {
  sale: CreditSaleDetailDTO;
  accounts: ReceivingAcct[];
  backHref: string;
}) {
  const owing = Math.max(0, sale.total - sale.amountPaid);
  const settled = owing <= 0;

  // Days-to-due urgency (only meaningful while the debt is open).
  const due = sale.dueDate ? new Date(sale.dueDate) : null;
  const daysToDue = due
    ? Math.ceil((due.getTime() - Date.now()) / DAY)
    : null;
  const overdue = !settled && daysToDue != null && daysToDue < 0;
  const dueSoon = !settled && daysToDue != null && daysToDue >= 0 && daysToDue <= 7;

  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Debt &amp; settlements
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {sale.customerName}
            </h1>
            {sale.creditStatus && <StatusBadge status={sale.creditStatus} />}
            {sale.creditSuspended && <Badge variant="destructive">credit suspended</Badge>}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{sale.code}</span>
            {sale.customerPhone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-3.5" /> {sale.customerPhone}
              </span>
            )}
            {sale.customerLocation && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" /> {sale.customerLocation}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="size-3.5 text-primary" /> rep {sale.repName}
            </span>
          </div>
        </div>
        {!settled && (
          <FieldCollectionButton
            saleId={sale.id}
            saleCode={sale.code}
            owing={owing}
            accounts={accounts}
          />
        )}
      </div>

      {/* Due-date urgency banner */}
      {due && !settled && (
        <div
          className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${
            overdue
              ? "border-destructive/40 bg-destructive/[0.06] text-destructive"
              : dueSoon
                ? "border-warning/40 bg-warning/[0.06] text-warning"
                : "border-border bg-muted/30 text-muted-foreground"
          }`}
        >
          {overdue ? <AlertTriangle className="size-4" /> : <CalendarClock className="size-4" />}
          {overdue
            ? `Overdue by ${Math.abs(daysToDue!)} day${Math.abs(daysToDue!) === 1 ? "" : "s"} — was due ${formatDate(sale.dueDate!)}. Collect as soon as possible.`
            : dueSoon
              ? `Due in ${daysToDue} day${daysToDue === 1 ? "" : "s"} (${formatDate(sale.dueDate!)}) — collect soon.`
              : `Due ${formatDate(sale.dueDate!)} (in ${daysToDue} days).`}
        </div>
      )}

      {/* Numbers */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Order total" value={formatCurrency(sale.total)} icon={Wallet} accent="primary" />
        <StatCard label="Collected" value={formatCurrency(sale.amountPaid)} icon={Banknote} accent="success" hint={`${sale.payments.length} payment${sale.payments.length === 1 ? "" : "s"}`} />
        <StatCard label="Owing" value={formatCurrency(owing)} accent={owing > 0 ? "warning" : "success"} />
        <StatCard
          label="Due date"
          value={sale.dueDate ? formatDate(sale.dueDate) : "—"}
          accent={overdue ? "warning" : "info"}
          hint={settled ? "settled" : due ? (overdue ? `${Math.abs(daysToDue!)}d overdue` : `in ${daysToDue}d`) : undefined}
        />
      </div>

      {/* Order items */}
      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">Order</h2>
        <div className="rounded-2xl border border-border bg-card">
          <ul className="divide-y divide-border/60">
            {sale.items.map((i, idx) => (
              <li key={idx} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate">
                  {formatNumber(i.quantity)} × {i.name}
                  <span className="text-muted-foreground"> @ {formatCurrency(i.unitPrice)}</span>
                </span>
                <span className="shrink-0 font-medium">{formatCurrency(i.lineTotal)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Collection history */}
      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">Payments collected</h2>
        {sale.payments.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Nothing collected yet. Use “Record payment” above when the customer pays.
          </p>
        ) : (
          <div className="rounded-2xl border border-border bg-card">
            <ul className="divide-y divide-border/60">
              {sale.payments.map((p, idx) => (
                <li key={idx} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span className="min-w-0">
                    <span
                      className={
                        p.status === "APPROVED"
                          ? "font-semibold text-success"
                          : "font-semibold text-warning"
                      }
                    >
                      +{formatCurrency(p.amount)}
                    </span>
                    {p.status === "PENDING" && (
                      <span className="ml-2 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                        Awaiting finance
                      </span>
                    )}
                    <span className="ml-2 text-muted-foreground">
                      {p.method ?? "payment"}
                      {p.account ? ` → ${p.account}` : ""}
                      {p.reference ? ` · ref ${p.reference}` : ""}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {formatDateTime(p.createdAt)} · recorded by {p.recordedBy}
                    </span>
                    {p.note && (
                      <span className="mt-1 block text-xs italic text-muted-foreground">
                        &ldquo;{p.note}&rdquo;
                      </span>
                    )}
                  </span>
                  {p.proofUrl && <ProofViewer url={p.proofUrl} label="Proof" compact />}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
