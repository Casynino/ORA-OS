import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getRepOverview } from "@/lib/services/field";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { Target } from "lucide-react";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function RepTargetsPage() {
  const me = await requireRole("SALES_REP");
  const now = new Date();
  const [d, history] = await Promise.all([
    getRepOverview(me.id),
    prisma.repTarget.findMany({
      where: { repId: me.id },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 12,
    }),
  ]);
  const t = d.target;

  const rows = t
    ? [
        { label: "Sales target", done: d.salesMonth, goal: t.salesTarget, money: true },
        { label: "Units target", done: d.unitsMonth, goal: t.unitsTarget, money: false },
        { label: "Cash collection", done: d.cashCollectedMonth, goal: t.cashTarget, money: true },
        { label: "Credit recovery", done: d.creditCollectedMonth, goal: t.creditRecoveryTarget, money: true },
      ].filter((x) => x.goal > 0)
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My targets"
        description={`${MONTHS[now.getMonth()]} ${now.getFullYear()} — how you're tracking against the goals the ORA team set.`}
      />

      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
        {rows.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Target className="size-4" />
            No targets have been set for this month yet.
          </p>
        ) : (
          <div className="space-y-5">
            {rows.map((x) => {
              const pct = Math.min(100, Math.round((x.done / x.goal) * 100));
              const remaining = Math.max(0, x.goal - x.done);
              return (
                <div key={x.label}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">{x.label}</span>
                    <span className="text-sm">
                      <span className="font-semibold">
                        {x.money ? formatCurrency(x.done) : formatNumber(x.done)}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}/ {x.money ? formatCurrency(x.goal) : formatNumber(x.goal)}
                      </span>
                    </span>
                  </div>
                  <Progress
                    value={pct}
                    className="mt-2"
                    indicatorClassName={cn(
                      pct >= 100 ? "bg-success" : pct >= 60 ? "bg-primary" : "bg-warning",
                    )}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {pct >= 100
                      ? "Target smashed — hongera! 🎉"
                      : `${pct}% there · ${x.money ? formatCurrency(remaining) : formatNumber(remaining)} to go`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {history.length > 1 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">Past months</h2>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {history
              .filter((h) => !(h.year === now.getFullYear() && h.month === now.getMonth() + 1))
              .map((h) => (
                <div key={h.id} className="rounded-2xl border border-border bg-card p-4">
                  <p className="font-semibold">{MONTHS[h.month - 1]} {h.year}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sales {formatCurrency(h.salesTarget)} · {formatNumber(h.unitsTarget)} units
                  </p>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
