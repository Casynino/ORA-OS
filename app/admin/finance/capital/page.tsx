import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { FinanceNav } from "@/components/admin/finance-nav";
import { AddCapitalButton, DeleteCapitalButton } from "@/components/admin/finance-forms";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { PiggyBank } from "lucide-react";
import { formatCurrency, formatDate, humanize } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminCapitalPage() {
  await requireRole("ADMIN");

  const entries = await prisma.capitalEntry.findMany({
    orderBy: { entryDate: "desc" },
    include: { recordedBy: { select: { name: true } } },
  });

  const total = entries.reduce((s, e) => s + e.amount, 0);
  const byType = new Map<string, number>();
  for (const e of entries) byType.set(e.type, (byType.get(e.type) ?? 0) + e.amount);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business capital"
        description="How ORA is funded and grows — founder money, investments, reinvested profit."
      >
        <FinanceNav />
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span>
            Total capital: <span className="font-display text-lg font-bold">{formatCurrency(total)}</span>
          </span>
          {[...byType.entries()].map(([t, v]) => (
            <span key={t} className="text-muted-foreground">
              {humanize(t)}: <span className="font-semibold text-foreground">{formatCurrency(v)}</span>
            </span>
          ))}
        </div>
        <AddCapitalButton />
      </div>

      {entries.length === 0 ? (
        <EmptyState
          className="rounded-2xl border border-dashed border-border py-14"
          icon={PiggyBank}
          title="No capital recorded yet"
          description="Record the founder's initial investment and every top-up, so growth is measurable."
        />
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold">{e.source}</p>
                  <Badge variant="accent">{humanize(e.type)}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {e.code} · {formatDate(e.entryDate)} · by {e.recordedBy.name}
                  {e.note ? ` · ${e.note}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-sm font-bold text-success">+{formatCurrency(e.amount)}</span>
                <DeleteCapitalButton id={e.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
