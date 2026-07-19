import Link from "next/link";
import { Users, MapPin, ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatNumber, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Every field customer across the whole sales team — with clear ownership. */
export default async function AdminFieldCustomersPage() {
  await requireRole("ADMIN");

  const customers = await prisma.fieldCustomer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      rep: { select: { id: true, name: true } },
      // Rep-management view keeps PENDING visible but never counts finance-
      // REJECTED sales toward revenue/owed. `isOpeningBalance` lets us keep
      // migrated debt in outstanding while excluding it from lifetime sales.
      sales: {
        where: { voided: false, financeStatus: { not: "REJECTED" } },
        select: { total: true, amountPaid: true, type: true, isOpeningBalance: true },
      },
    },
  });

  const realTotal = (sales: { total: number; isOpeningBalance: boolean }[]) =>
    sales.filter((x) => !x.isOpeningBalance).reduce((t, x) => t + x.total, 0);

  const totals = {
    customers: customers.length,
    reps: new Set(customers.map((c) => c.repId).filter(Boolean)).size,
    revenue: customers.reduce((s, c) => s + realTotal(c.sales), 0),
    outstanding: customers.reduce(
      (s, c) =>
        s +
        c.sales
          .filter((x) => x.type === "CREDIT")
          .reduce((t, x) => t + Math.max(0, x.total - x.amountPaid), 0),
      0,
    ),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Field customers"
        description="Every customer in ORA's central database — managed by a sales rep, or held by Finance/Admin until assigned."
      >
        <div className="flex items-center gap-3">
          <Link
            href="/admin/reps"
            className="text-sm font-medium text-primary hover:underline"
          >
            ← Sales reps
          </Link>
          <Link
            href="/admin/reps/customers/new"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            + Register customer
          </Link>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Customers" value={formatNumber(totals.customers)} icon={Users} />
        <StatCard label="Acquired by" value={`${totals.reps} rep${totals.reps === 1 ? "" : "s"}`} accent="info" />
        <StatCard label="Lifetime sales" value={formatCurrency(totals.revenue)} accent="success" />
        <StatCard label="Outstanding credit" value={formatCurrency(totals.outstanding)} accent={totals.outstanding > 0 ? "warning" : "info"} />
      </div>

      {customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No field customers yet"
          description="Customers created by sales reps will appear here with their owner."
        />
      ) : (
        <div className="space-y-2">
          {customers.map((c) => {
            const revenue = realTotal(c.sales);
            const realSaleCount = c.sales.filter((x) => !x.isOpeningBalance).length;
            const owed = c.sales
              .filter((x) => x.type === "CREDIT")
              .reduce((s, x) => s + Math.max(0, x.total - x.amountPaid), 0);
            return (
              <Link
                key={c.id}
                href={`/admin/reps/customers/${c.id}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold">{c.businessName ?? c.name}</p>
                    {c.customerType && <Badge variant="secondary">{c.customerType}</Badge>}
                    {c.creditSuspended && (
                      <Badge variant="destructive">credit suspended</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">
                      Rep: {c.rep?.name ?? "Unassigned"}
                    </span>
                    {(c.location || c.region) && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" />
                        {[c.location, c.region].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {c.phone && <span>{c.phone}</span>}
                    <span>added {timeAgo(c.createdAt)}</span>
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold">{formatCurrency(revenue)}</p>
                  <p className="text-xs text-muted-foreground">
                    {realSaleCount} sale{realSaleCount === 1 ? "" : "s"}
                    {owed > 0 ? ` · owes ${formatCurrency(owed)}` : ""}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
