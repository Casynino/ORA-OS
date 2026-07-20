import Link from "next/link";
import {
  CalendarDays, CalendarRange, CalendarClock, TrendingUp, Banknote, CreditCard,
  Clock, Package, BadgeCheck, Building2, ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/admin/kpi-card";
import { getSalesDashboard, type SalesLeader } from "@/lib/services/sales-history";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminSalesDashboardPage() {
  const d = await getSalesDashboard();

  return (
    <div className="space-y-6">
      <PageHeader title="Sales insights" description="Sales performance and trends across every channel — always in sync with Sales history.">
        <Link href="/admin/sales" className={cn(buttonVariants({ size: "sm", variant: "outline" }), "rounded-full")}>
          Sales history <ArrowRight className="ml-1.5 size-4" />
        </Link>
      </PageHeader>

      {/* Period revenue (confirmed sales) */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Sales today" value={d.revenueToday} prefix="TSh " icon={CalendarDays} accent="primary" />
        <KpiCard label="This week" value={d.revenueWeek} prefix="TSh " icon={CalendarRange} accent="info" />
        <KpiCard label="This month" value={d.revenueMonth} prefix="TSh " icon={CalendarClock} accent="accent" />
        <KpiCard label="Total revenue" value={d.revenue} prefix="TSh " icon={TrendingUp} accent="success" />
      </div>

      {/* Mix + what's owed / pending */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Cash sales" value={d.cash} prefix="TSh " icon={Banknote} accent="success" />
        <KpiCard label="Credit sales" value={d.credit} prefix="TSh " icon={CreditCard} accent="accent" />
        <KpiCard label="Credit collected" value={d.collected} prefix="TSh " icon={Banknote} accent={d.collected > 0 ? "success" : "warning"} />
        <KpiCard label="Awaiting confirmation" value={d.counts.pending} icon={Clock} accent={d.counts.pending > 0 ? "warning" : "success"} />
      </div>

      {/* Trend + mix */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 lg:col-span-2">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Revenue — last 14 days</p>
          {(() => {
            const max = Math.max(1, ...d.trend.map((t) => t.value));
            return (
              <div className="flex h-40 items-end gap-1.5">
                {d.trend.map((t, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-md bg-primary/70 transition-colors hover:bg-primary"
                        style={{ height: `${Math.max((t.value / max) * 100, t.value > 0 ? 4 : 0)}%` }}
                        title={`Day ${t.label}: ${formatCurrency(t.value)}`}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground">{t.label}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sales mix</p>
          <MixRow label="Field & office" value={d.channelMix.field} total={d.revenue} tone="bg-primary" />
          <MixRow label="Partner & direct" value={d.channelMix.partner} total={d.revenue} tone="bg-accent" />
          <div className="my-3 border-t border-border/60" />
          <MixRow label="Cash" value={d.cash} total={d.revenue} tone="bg-success" />
          <MixRow label="Credit" value={d.credit} total={d.revenue} tone="bg-info" />
        </div>
      </div>

      {/* Leaderboards */}
      <div className="grid gap-4 lg:grid-cols-3">
        <LeaderCard title="Top products" icon={<Package className="size-4" />} rows={d.topProducts.map((p) => ({ name: p.name, value: p.value, sub: `${formatNumber(p.pieces)} pcs` }))} />
        <LeaderCard title="Top sales reps" icon={<BadgeCheck className="size-4" />} rows={d.topReps.map((r) => ({ name: r.name, value: r.value, sub: `${formatNumber(r.count)} sale${r.count === 1 ? "" : "s"}` }))} />
        <LeaderCard title="Top customers" icon={<Building2 className="size-4" />} rows={d.topCustomers.map((c) => ({ name: c.name, value: c.value, sub: `${formatNumber(c.count)} order${c.count === 1 ? "" : "s"}` }))} />
      </div>
    </div>
  );
}

function MixRow({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="shrink-0 font-medium tabular-nums">{formatCurrency(value)} · {pct}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function LeaderCard({
  title,
  icon,
  rows,
}: {
  title: string;
  icon: React.ReactNode;
  rows: { name: string; value: number; sub: string }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {title}
      </p>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No confirmed sales yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">{i + 1}</span>
                  <span className="truncate font-medium">{r.name}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{formatCurrency(r.value)}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 pl-7">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.round((r.value / max) * 100)}%` }} />
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">{r.sub}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
