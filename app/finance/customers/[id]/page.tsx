import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  MapPin,
  BadgeCheck,
  Wallet,
  Banknote,
} from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { CustomerCreditToggle } from "@/components/admin/rep-controls";
import { CustomerProfileCard } from "@/components/field/customer-profile-card";
import { FieldCollectionButton } from "@/components/finance/field-collection-button";
import { formatCurrency, formatDate, formatNumber, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Finance view of one field customer — profile, credit standing and full
 *  APPROVED sales history. Finance can suspend/restore credit and collect
 *  payments against each loan; it cannot edit the rep relationship. */
export default async function FinanceFieldCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("FINANCE");
  const { id } = await params;

  const [customer, accounts] = await Promise.all([
    prisma.fieldCustomer.findUnique({
      where: { id },
      include: {
        rep: { select: { id: true, name: true, region: true } },
        sales: {
          // Finance works from verified figures — approved, non-voided sales.
          where: { voided: false, financeStatus: "APPROVED" },
          orderBy: { createdAt: "desc" },
          include: {
            items: { include: { product: { select: { name: true } } } },
            payments: {
              where: { financeStatus: "APPROVED" },
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    }),
    // Official ORA accounts a collection can be received into.
    prisma.paymentAccount.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, accountName: true, accountNumber: true },
    }),
  ]);
  if (!customer) notFound();

  const revenue = customer.sales.reduce((s, x) => s + x.total, 0);
  const paid = customer.sales.reduce((s, x) => s + x.amountPaid, 0);
  const owed = customer.sales
    .filter((x) => x.type === "CREDIT")
    .reduce((s, x) => s + Math.max(0, x.total - x.amountPaid), 0);

  return (
    <div className="space-y-6">
      <Link
        href="/finance/customers"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Customer database
      </Link>

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
            <span>customer since {formatDate(customer.createdAt)}</span>
          </div>
          <p className="mt-2 text-sm">
            <span className="text-muted-foreground">Managed by rep: </span>
            <span className="inline-flex items-center gap-1 font-medium">
              <BadgeCheck className="size-3.5 text-primary" />
              {customer.rep.name}
            </span>
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Lifetime sales" value={formatCurrency(revenue)} icon={Wallet} accent="primary" hint={`${customer.sales.length} sale${customer.sales.length === 1 ? "" : "s"}`} />
        <StatCard label="Paid" value={formatCurrency(paid)} icon={Banknote} accent="success" />
        <StatCard label="Outstanding" value={formatCurrency(owed)} accent={owed > 0 ? "warning" : "info"} />
        <StatCard label="Last activity" value={customer.sales[0] ? timeAgo(customer.sales[0].createdAt) : "—"} accent="info" />
      </div>

      <CustomerProfileCard c={customer} />

      {customer.notes && (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</p>
          <p className="mt-1">{customer.notes}</p>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Sales history</h2>
        {customer.sales.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            No verified sales for this customer yet.
          </p>
        ) : (
          <div className="space-y-2">
            {customer.sales.map((s) => (
              <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display font-semibold">{s.code}</span>
                    <StatusBadge status={s.type} />
                    {s.creditStatus && <StatusBadge status={s.creditStatus} />}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(s.total)}</p>
                    {s.type === "CREDIT" && (
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
                  {s.items.map((i) => `${formatNumber(i.quantity)} × ${i.product.name}`).join(" · ")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(s.createdAt)}
                  {s.dueDate ? ` · due ${formatDate(s.dueDate)}` : ""}
                  {s.payments.length > 0
                    ? ` · ${s.payments.length} payment${s.payments.length === 1 ? "" : "s"}`
                    : ""}
                </p>
                {s.type === "CREDIT" && s.total - s.amountPaid > 0 && (
                  <div className="mt-3 border-t border-border/50 pt-3">
                    <FieldCollectionButton
                      saleId={s.id}
                      saleCode={s.code}
                      owing={s.total - s.amountPaid}
                      accounts={accounts}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
