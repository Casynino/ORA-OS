import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { refreshOverdueFieldCredit } from "@/lib/services/field";
import { PageHeader } from "@/components/ui/page-header";
import { NewCustomerForm } from "@/components/field/field-forms";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Users, CreditCard, AlertTriangle, ChevronRight } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RepCustomersPage() {
  const me = await requireRole("SALES_REP");
  await refreshOverdueFieldCredit();

  const customers = await prisma.fieldCustomer.findMany({
    where: { repId: me.id },
    orderBy: { name: "asc" },
    include: {
      sales: {
        // Rejected sales don't count toward the customer's totals.
        where: { voided: false, financeStatus: { not: "REJECTED" } },
        select: { total: true, amountPaid: true, type: true, creditStatus: true },
      },
    },
  });

  const rows = customers.map((c) => {
    const credit = c.sales.filter((s) => s.type === "CREDIT");
    const owed = credit.reduce((s, x) => s + (x.total - x.amountPaid), 0);
    const overdue = credit.some((x) => x.creditStatus === "OVERDUE");
    const bought = c.sales.reduce((s, x) => s + x.total, 0);
    return { ...c, owed, overdue, bought, orders: c.sales.length };
  });

  const totalOwed = rows.reduce((s, r) => s + r.owed, 0);
  const debtors = rows.filter((r) => r.owed > 0).length;
  const overdueCount = rows.filter((r) => r.overdue).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers & credit"
        description="Your customer book — who owes what, and their full history."
      >
        <NewCustomerForm />
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Customers" value={formatNumber(rows.length)} icon={Users} accent="primary" />
        <StatCard label="Outstanding credit" value={formatCurrency(totalOwed)} icon={CreditCard} accent="warning" hint={`${debtors} with balances`} />
        <StatCard label="Overdue" value={formatNumber(overdueCount)} icon={AlertTriangle} accent={overdueCount > 0 ? "warning" : "success"} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          className="rounded-2xl border border-dashed border-border py-12"
          icon={Users}
          title="No customers yet"
          description="Add customers here, or they'll be created automatically when you record a credit sale."
        />
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <Link
              key={c.id}
              href={`/rep/customers/${c.id}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold">{c.businessName ?? c.name}</p>
                  {c.customerType && <Badge variant="secondary">{c.customerType}</Badge>}
                  {c.overdue && <Badge variant="destructive">Overdue</Badge>}
                  {c.creditSuspended && <Badge variant="secondary">Credit off</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {c.orders} purchase{c.orders === 1 ? "" : "s"} · bought {formatCurrency(c.bought)}
                  {c.location ? ` · ${c.location}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="text-right">
                  <p className={c.owed > 0 ? "font-semibold text-warning" : "font-semibold text-success"}>
                    {c.owed > 0 ? formatCurrency(c.owed) : "Clear"}
                  </p>
                  {c.owed > 0 && <p className="text-[10px] text-muted-foreground">owing</p>}
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
