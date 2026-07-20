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
      <PageHeader title="Sales dashboard" description="Sales performance at a glance — across every channel, always in sync with Sales history.">
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

      {/* Leaderboards */}
      <div className="grid gap-4 lg:grid-cols-3">
        <LeaderCard title="Top products" icon={<Package className="size-4" />} rows={d.topProducts.map((p) => ({ name: p.name, value: p.value, sub: `${formatNumber(p.pieces)} pcs` }))} />
        <LeaderCard title="Top sales reps" icon={<BadgeCheck className="size-4" />} rows={d.topReps.map((r) => ({ name: r.name, value: r.value, sub: `${formatNumber(r.count)} sale${r.count === 1 ? "" : "s"}` }))} />
        <LeaderCard title="Top customers" icon={<Building2 className="size-4" />} rows={d.topCustomers.map((c) => ({ name: c.name, value: c.value, sub: `${formatNumber(c.count)} order${c.count === 1 ? "" : "s"}` }))} />
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
