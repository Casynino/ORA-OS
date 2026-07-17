import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone, MapPin } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { refreshOverdueFieldCredit } from "@/lib/services/field";
import { CollectForm } from "@/components/field/field-forms";
import { CustomerProfileCard } from "@/components/field/customer-profile-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { CreditCard, ShoppingCart, Banknote } from "lucide-react";
import { formatCurrency, formatDate, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RepCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireRole("SALES_REP");
  const { id } = await params;
  await refreshOverdueFieldCredit();

  const [customer, accounts] = await Promise.all([
    prisma.fieldCustomer.findUnique({
      where: { id },
      include: {
        sales: {
          orderBy: { createdAt: "desc" },
          include: {
            items: { include: { product: { select: { name: true } } } },
            payments: { orderBy: { createdAt: "desc" } },
          },
        },
      },
    }),
    prisma.paymentAccount.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, accountName: true, accountNumber: true },
    }),
  ]);
  if (!customer || customer.repId !== me.id) notFound();

  // Finance-rejected sales never happened — exclude them from every total.
  const live = customer.sales.filter(
    (s) => !s.voided && s.financeStatus !== "REJECTED",
  );
  const owed = live
    .filter((s) => s.type === "CREDIT")
    .reduce((s, x) => s + (x.total - x.amountPaid), 0);
  const bought = live.reduce((s, x) => s + x.total, 0);
  const paid = live.reduce(
    (s, x) => s + (x.type === "CASH" ? x.total : x.amountPaid),
    0,
  );

  return (
    <div className="space-y-6">
      <Link
        href="/rep/customers"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All customers
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {customer.name}
        </h1>
        {customer.creditSuspended && <Badge variant="destructive">Credit suspended</Badge>}
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        {customer.phone && (
          <span className="inline-flex items-center gap-1.5"><Phone className="size-3.5" /> {customer.phone}</span>
        )}
        {customer.location && (
          <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" /> {customer.location}</span>
        )}
        <span>Customer since {formatDate(customer.createdAt)}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Outstanding" value={formatCurrency(owed)} icon={CreditCard} accent={owed > 0 ? "warning" : "success"} />
        <StatCard label="Total purchased" value={formatCurrency(bought)} icon={ShoppingCart} accent="primary" />
        <StatCard label="Total paid" value={formatCurrency(paid)} icon={Banknote} accent="success" />
      </div>

      <CustomerProfileCard c={customer} />

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Purchases & payments</h2>
        <div className="space-y-3">
          {customer.sales.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No purchases yet.
            </p>
          ) : (
            customer.sales.map((s) => {
              const balance = s.total - s.amountPaid;
              return (
                <div
                  key={s.id}
                  className={`rounded-2xl border border-border bg-card p-4 shadow-soft${
                    s.voided || s.financeStatus === "REJECTED" ? " opacity-60" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{s.code}</span>
                      <StatusBadge status={s.type} />
                      {s.creditStatus && <StatusBadge status={s.creditStatus} />}
                      {s.voided && <Badge variant="destructive">Voided</Badge>}
                      {!s.voided && s.financeStatus === "PENDING" && (
                        <Badge variant="warning">Awaiting finance</Badge>
                      )}
                      {!s.voided && s.financeStatus === "REJECTED" && (
                        <Badge variant="destructive">Rejected by finance</Badge>
                      )}
                    </div>
                    <span className="text-sm font-semibold">{formatCurrency(s.total)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.items.map((i) => `${i.product.name} × ${i.quantity}`).join(" · ")}
                    {" · "}
                    {timeAgo(s.createdAt)}
                    {s.dueDate ? ` · due ${formatDate(s.dueDate)}` : ""}
                  </p>

                  {s.type === "CREDIT" && !s.voided && s.financeStatus !== "REJECTED" && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                      <p className="text-sm">
                        Paid{" "}
                        <span className="font-semibold text-success">{formatCurrency(s.amountPaid)}</span>
                        {balance > 0 && (
                          <>
                            {" · "}owing{" "}
                            <span className="font-semibold text-warning">{formatCurrency(balance)}</span>
                          </>
                        )}
                      </p>
                      {balance > 0 && <CollectForm saleId={s.id} balance={balance} accounts={accounts} />}
                    </div>
                  )}

                  {s.payments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {s.payments.map((p) => (
                        <p key={p.id} className="text-xs text-muted-foreground">
                          ✓ {formatCurrency(p.amount)} {p.method ? `by ${p.method.toLowerCase()}` : ""} · {timeAgo(p.createdAt)}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
