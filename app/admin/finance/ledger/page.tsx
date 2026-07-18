import { requireRole } from "@/lib/rbac";
import { getLedger, type Period } from "@/lib/services/finance";
import { PageHeader } from "@/components/ui/page-header";
import { FinanceNav, PeriodTabs } from "@/components/admin/finance-nav";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { ScrollText } from "lucide-react";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  SALE: "Sale",
  CREDIT_COLLECTED: "Credit payment",
  FIELD_SALE: "Field sale",
  FIELD_COLLECTION: "Field collection",
  EXPENSE: "Expense",
  CAPITAL: "Capital",
};

export default async function AdminLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireRole("ADMIN");
  // The ledger is ORA's full accounting history, so it defaults to All time —
  // every movement shows (incl. back-dated expenses) instead of just this month.
  const { period: raw = "all" } = await searchParams;
  const period = (["today", "week", "month", "all"].includes(raw) ? raw : "all") as Period;

  const rows = await getLedger(period, 250);
  const totalIn = rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const totalOut = rows.filter((r) => r.amount < 0).reduce((s, r) => s - r.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transaction ledger"
        description="Every financial movement in one place — the accounting history of ORA."
      />
      <FinanceNav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodTabs period={period} basePath="/admin/finance/ledger" />
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <span className="text-success">In: <span className="font-semibold">{formatCurrency(totalIn)}</span></span>
          <span className="text-destructive">Out: <span className="font-semibold">{formatCurrency(totalOut)}</span></span>
          <span>Net: <span className="font-semibold">{formatCurrency(totalIn - totalOut)}</span></span>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          className="rounded-2xl border border-dashed border-border py-14"
          icon={ScrollText}
          title="No transactions in this period"
        />
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-soft">
          {rows.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3 last:border-0 sm:px-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium">{e.label}</p>
                  <Badge variant={e.amount >= 0 ? "success" : "destructive"}>
                    {KIND_LABEL[e.kind] ?? e.kind}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {e.reference} · {e.category} · {formatDateTime(e.date)}
                  {e.method ? ` · ${e.method}` : ""}
                  {e.actor ? ` · by ${e.actor}` : ""}
                </p>
              </div>
              <span className={cn("shrink-0 text-sm font-bold", e.amount >= 0 ? "text-success" : "text-destructive")}>
                {e.amount >= 0 ? "+" : "−"}{formatCurrency(Math.abs(e.amount))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
