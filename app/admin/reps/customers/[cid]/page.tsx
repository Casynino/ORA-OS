import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  MapPin,
  BadgeCheck,
  Wallet,
  Banknote,
  ExternalLink,
} from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { CustomerCreditToggle } from "@/components/admin/rep-controls";
import { CustomerProfileCard } from "@/components/field/customer-profile-card";
import { formatCurrency, formatDate, formatNumber, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Admin view of one field customer — owner rep, profile, full sales history. */
export default async function AdminFieldCustomerPage({
  params,
}: {
  params: Promise<{ cid: string }>;
}) {
  await requireRole("ADMIN");
  const { cid } = await params;

  const customer = await prisma.fieldCustomer.findUnique({
    where: { id: cid },
    include: {
      rep: { select: { id: true, name: true, region: true } },
      sales: {
        orderBy: { createdAt: "desc" },
        include: {
          items: { include: { product: { select: { name: true } } } },
          payments: { orderBy: { createdAt: "desc" } },
        },
      },
    },
  });
  if (!customer) notFound();

  // Finance-rejected sales never happened — exclude them from every total.
  const live = customer.sales.filter(
    (s) => !s.voided && s.financeStatus !== "REJECTED",
  );
  const revenue = live.reduce((s, x) => s + x.total, 0);
  const paid = live.reduce((s, x) => s + x.amountPaid, 0);
  const owed = live
    .filter((x) => x.type === "CREDIT")
    .reduce((s, x) => s + Math.max(0, x.total - x.amountPaid), 0);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/reps/customers"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All field customers
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {customer.businessName ?? customer.name}
            </h1>
            {customer.customerType && (
              <Badge variant="secondary">{customer.customerType}</Badge>
            )}
            {customer.creditSuspended && (
              <Badge variant="destructive">credit suspended</Badge>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {customer.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-3.5" /> {customer.phone}
              </span>
            )}
            {(customer.location || customer.region) && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {[customer.location, customer.region].filter(Boolean).join(", ")}
              </span>
            )}
            {customer.gpsLat != null && customer.gpsLng != null && (
              <a
                href={`https://maps.google.com/?q=${customer.gpsLat},${customer.gpsLng}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                GPS <ExternalLink className="size-3" />
              </a>
            )}
            <span>customer since {formatDate(customer.createdAt)}</span>
          </div>
          <p className="mt-2 text-sm">
            <span className="text-muted-foreground">Assigned sales rep: </span>
            <Link
              href={`/admin/reps/${customer.rep.id}`}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <BadgeCheck className="size-3.5" />
              {customer.rep.name}
            </Link>
            {customer.rep.region && (
              <span className="text-muted-foreground"> · {customer.rep.region}</span>
            )}
          </p>
        </div>
        <CustomerCreditToggle
          customerId={customer.id}
          suspended={customer.creditSuspended}
        />
      </div>

      {/* Numbers */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Lifetime sales" value={formatCurrency(revenue)} icon={Wallet} accent="primary" hint={`${live.length} sale${live.length === 1 ? "" : "s"}`} />
        <StatCard label="Paid" value={formatCurrency(paid)} icon={Banknote} accent="success" />
        <StatCard label="Outstanding" value={formatCurrency(owed)} accent={owed > 0 ? "warning" : "info"} />
        <StatCard label="Last activity" value={live[0] ? timeAgo(live[0].createdAt) : "—"} accent="info" />
      </div>

      <CustomerProfileCard c={customer} />

      {customer.notes && (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</p>
          <p className="mt-1">{customer.notes}</p>
        </div>
      )}

      {/* Sales history */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Sales history</h2>
        {customer.sales.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            No sales recorded for this customer yet.
          </p>
        ) : (
          <div className="space-y-2">
            {customer.sales.map((s) => (
              <div
                key={s.id}
                className={`rounded-2xl border bg-card p-4 ${s.voided || s.financeStatus === "REJECTED" ? "border-border opacity-60" : "border-border"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display font-semibold">{s.code}</span>
                    <StatusBadge status={s.type} />
                    {s.creditStatus && s.financeStatus !== "REJECTED" && <StatusBadge status={s.creditStatus} />}
                    {s.voided && <Badge variant="destructive">voided</Badge>}
                    {!s.voided && s.financeStatus === "REJECTED" && (
                      <Badge variant="destructive">rejected by finance</Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(s.total)}</p>
                    {s.type === "CREDIT" && !s.voided && s.financeStatus !== "REJECTED" && (
                      <p className="text-xs text-muted-foreground">
                        paid {formatCurrency(s.amountPaid)}
                        {s.total - s.amountPaid > 0
                          ? ` · owes ${formatCurrency(s.total - s.amountPaid)}`
                          : " · settled"}
                      </p>
                    )}
                  </div>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {s.items
                    .map((i) => `${formatNumber(i.quantity)} × ${i.product.name}`)
                    .join(" · ")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(s.createdAt)}
                  {s.dueDate ? ` · due ${formatDate(s.dueDate)}` : ""}
                  {s.payments.length > 0
                    ? ` · ${s.payments.length} payment${s.payments.length === 1 ? "" : "s"}`
                    : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
