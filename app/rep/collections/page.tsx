import Link from "next/link";
import { CreditCard, AlertTriangle, ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { refreshOverdueFieldCredit } from "@/lib/services/field";
import { getFieldCustomerRows } from "@/lib/services/customer-profile";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RepCollectionsPage() {
  const me = await requireRole("SALES_REP");
  await refreshOverdueFieldCredit();

  const rows = (await getFieldCustomerRows({ repId: me.id }))
    .filter((r) => r.outstanding > 0)
    // Chase the riskiest first: overdue, then largest balance.
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.outstanding - a.outstanding);

  const totalOwed = rows.reduce((s, r) => s + r.outstanding, 0);
  const overdue = rows.filter((r) => r.overdue).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Collections"
        description="Customers who owe you — open one to record a payment and upload the proof."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Customers owing" value={formatNumber(rows.length)} icon={CreditCard} accent="warning" />
        <StatCard label="Total outstanding" value={formatCurrency(totalOwed)} icon={CreditCard} accent="warning" />
        <StatCard label="Overdue" value={formatNumber(overdue)} icon={AlertTriangle} accent={overdue > 0 ? "warning" : "success"} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          className="rounded-2xl border border-dashed border-border py-12"
          icon={CreditCard}
          title="Nothing to collect"
          description="None of your customers have an outstanding balance."
        />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link
              key={r.id}
              href={`/rep/customers/${r.id}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold">{r.businessName}</p>
                  {r.overdue && <Badge variant="destructive" className="text-[10px]">Overdue</Badge>}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {[r.phone, r.region].filter(Boolean).join(" · ") || "—"}
                  {r.lastPayment && ` · last paid ${formatDate(r.lastPayment)}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-right">
                <div>
                  <p className="text-[11px] text-muted-foreground">Owes</p>
                  <p className="font-semibold text-warning">{formatCurrency(r.outstanding)}</p>
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
