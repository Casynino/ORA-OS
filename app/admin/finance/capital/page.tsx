import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getFinanceOverview } from "@/lib/services/finance";
import { getSelectableAccounts } from "@/lib/services/accounts";
import { PageHeader } from "@/components/ui/page-header";
import { FinanceNav } from "@/components/admin/finance-nav";
import {
  AddCapitalButton,
  RecordWithdrawalButton,
  DeleteCapitalButton,
} from "@/components/admin/finance-forms";
import { ProofViewer } from "@/components/ui/proof-viewer";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { PiggyBank, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { cn, formatCurrency, formatDate, humanize } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminCapitalPage() {
  await requireRole("ADMIN");

  const [entries, overview, accounts] = await Promise.all([
    prisma.capitalEntry.findMany({
      orderBy: { entryDate: "desc" },
      include: {
        recordedBy: { select: { name: true } },
        paymentAccount: { select: { name: true } },
      },
    }),
    getFinanceOverview("all"),
    getSelectableAccounts(),
  ]);

  const injected = entries.reduce((s, e) => s + Math.max(0, e.amount), 0);
  const withdrawn = entries.reduce((s, e) => s + Math.max(0, -e.amount), 0);
  const netCapital = injected - withdrawn;
  const businessCapital = overview.position.businessCapital;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business capital"
        description="Money the owner puts in and takes out — the backbone of Business Capital. Every investment adds to what's available to run ORA; every withdrawal reduces it."
      />
      <FinanceNav />

      {/* Capital tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={Wallet} accent="text-success" label="Business Capital" value={formatCurrency(businessCapital)} hint="available to run ORA now" />
        <Tile icon={PiggyBank} accent="text-info" label="Net owner capital" value={formatCurrency(netCapital)} hint="invested − withdrawn" />
        <Tile icon={TrendingUp} accent="text-success" label="Total invested" value={formatCurrency(injected)} />
        <Tile icon={TrendingDown} accent="text-warning" label="Total withdrawn" value={formatCurrency(withdrawn)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Business Capital is calculated live from every payment, expense and capital move — it can&apos;t drift.
        </p>
        <div className="flex gap-2">
          <AddCapitalButton accounts={accounts} />
          <RecordWithdrawalButton accounts={accounts} />
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          className="rounded-2xl border border-dashed border-border py-14"
          icon={PiggyBank}
          title="No capital recorded yet"
          description="Record the founder's initial investment and every top-up or withdrawal, so growth is measurable."
        />
      ) : (
        <div className="space-y-2">
          {entries.map((e) => {
            const isWithdrawal = e.amount < 0;
            return (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">{e.source}</p>
                    <Badge variant={isWithdrawal ? "warning" : "accent"}>{humanize(e.type)}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {e.code} · {formatDate(e.entryDate)} · by {e.recordedBy.name}
                    {e.paymentAccount ? ` · ${isWithdrawal ? "from" : "into"} ${e.paymentAccount.name}` : ""}
                    {e.note ? ` · ${e.note}` : ""}
                  </p>
                  {e.receiptUrl && (
                    <div className="mt-1.5">
                      <ProofViewer url={e.receiptUrl} label="Document" compact />
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className={cn("text-sm font-bold", isWithdrawal ? "text-destructive" : "text-success")}>
                    {isWithdrawal ? "−" : "+"}{formatCurrency(Math.abs(e.amount))}
                  </span>
                  <DeleteCapitalButton id={e.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Tile({ icon: Icon, label, value, hint, accent }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className={cn("size-4 shrink-0", accent)} />
      </div>
      <p className="mt-2 font-display text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
