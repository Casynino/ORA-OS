import Link from "next/link";
import {
  ShoppingCart,
  Wallet,
  Package,
  Gift,
  CreditCard,
  PlusCircle,
  ArrowRight,
  Target,
  MapPin,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { getRepOverview } from "@/lib/services/field";
import { StatCard } from "@/components/ui/stat-card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatCurrency, formatNumber, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RepOverviewPage() {
  const me = await requireRole("SALES_REP");
  const d = await getRepOverview(me.id);
  const t = d.target;

  const targets = t
    ? [
        { label: "Sales", done: d.salesMonth, goal: t.salesTarget, money: true },
        { label: "Units", done: d.unitsMonth, goal: t.unitsTarget, money: false },
        { label: "Cash collected", done: d.cashCollectedMonth, goal: t.cashTarget, money: true },
        { label: "Credit recovered", done: d.creditCollectedMonth, goal: t.creditRecoveryTarget, money: true },
      ].filter((x) => x.goal > 0)
    : [];

  const quick = [
    { label: "Record sale", href: "/rep/sell", icon: ShoppingCart },
    { label: "Log samples", href: "/rep/samples", icon: Gift },
    { label: "Request stock", href: "/rep/stock", icon: PlusCircle },
    { label: "Submit report", href: "/rep/reports", icon: MapPin },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-accent/10 p-5 shadow-soft sm:p-7">
          <div className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Karibu,</p>
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                {(me.name ?? "Rep").split(" ")[0]} 👋
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="accent">Sales Rep</Badge>
                {d.overdueCount > 0 ? (
                  <Badge variant="destructive">{d.overdueCount} overdue debts</Badge>
                ) : (
                  <Badge variant="success">Book in order</Badge>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Today so far:{" "}
                <span className="font-semibold text-foreground">
                  {formatCurrency(d.salesToday)}
                </span>
              </p>
            </div>
            <Link
              href="/rep/sell"
              className={cn(
                buttonVariants({ size: "lg" }),
                "w-full shrink-0 rounded-full shadow-glow sm:w-auto",
              )}
            >
              <ShoppingCart className="size-5" />
              Record sale
            </Link>
          </div>
        </div>
      </Reveal>

      {/* Headline stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Sales today", value: formatCurrency(d.salesToday), icon: TrendingUp, accent: "primary" as const },
          { label: "This week", value: formatCurrency(d.salesWeek), icon: ShoppingCart, accent: "accent" as const },
          { label: "This month", value: formatCurrency(d.salesMonth), icon: Wallet, accent: "success" as const },
          { label: "Credit outstanding", value: formatCurrency(d.creditOutstanding), icon: CreditCard, accent: "warning" as const },
        ].map((s, i) => (
          <Reveal key={s.label} delay={i * 0.04}>
            <StatCard label={s.label} value={s.value} icon={s.icon} accent={s.accent} />
          </Reveal>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          { label: "Stock in hand", value: formatNumber(d.stockInHand), icon: Package, accent: "info" as const },
          { label: "Samples in hand", value: formatNumber(d.samplesInHand), icon: Gift, accent: "accent" as const },
          { label: "Samples this month", value: formatNumber(d.samplesMonth), icon: Gift, accent: "primary" as const },
          { label: "Units sold (month)", value: formatNumber(d.unitsMonth), icon: Package, accent: "success" as const },
        ].map((s, i) => (
          <Reveal key={s.label} delay={i * 0.04}>
            <StatCard label={s.label} value={s.value} icon={s.icon} accent={s.accent} />
          </Reveal>
        ))}
      </div>

      {/* Targets + stock */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Reveal>
          <div className="h-full rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Monthly targets</h2>
              <Link href="/rep/targets" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Details <ArrowRight className="size-4" />
              </Link>
            </div>
            {targets.length === 0 ? (
              <p className="mt-5 flex items-center gap-2 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                <Target className="size-4" />
                No targets set for this month yet — the ORA team will assign them.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                {targets.map((x) => {
                  const pct = Math.min(100, Math.round((x.done / x.goal) * 100));
                  return (
                    <div key={x.label}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{x.label}</span>
                        <span className="font-semibold">
                          {x.money ? formatCurrency(x.done) : formatNumber(x.done)}
                          <span className="text-muted-foreground">
                            {" "}/ {x.money ? formatCurrency(x.goal) : formatNumber(x.goal)}
                          </span>
                        </span>
                      </div>
                      <Progress
                        value={pct}
                        className="mt-1.5"
                        indicatorClassName={cn(
                          pct >= 100 ? "bg-success" : pct >= 60 ? "bg-primary" : "bg-warning",
                        )}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="h-full rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Stock in hand</h2>
              <Link href="/rep/stock" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                My stock <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {d.stock.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Nothing in hand yet — request stock to get started.
                </p>
              ) : (
                d.stock.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        sold {formatNumber(s.soldQty)} · sampled {formatNumber(s.sampledQty)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-sm">
                      <p className="font-semibold">{formatNumber(s.sellableQty)}</p>
                      <p className="text-xs text-muted-foreground">+{formatNumber(s.sampleQty)} samples</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            {d.pendingStockRequests > 0 && (
              <p className="mt-3 flex items-center gap-2 rounded-lg bg-warning/10 p-2.5 text-xs text-warning">
                <AlertCircle className="size-3.5" />
                {d.pendingStockRequests} stock request{d.pendingStockRequests === 1 ? "" : "s"} awaiting the ORA team
              </p>
            )}
          </div>
        </Reveal>
      </div>

      {/* Recent sales */}
      <Reveal>
        <div className="rounded-2xl border border-border bg-card shadow-soft">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Recent sales</h2>
            <Link href="/rep/sell" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              New sale <ArrowRight className="size-4" />
            </Link>
          </div>
          {d.recentSales.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No sales yet — record your first one.</p>
          ) : (
            <div>
              {d.recentSales.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 p-4 last:border-0">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{s.code}</span>
                      <StatusBadge status={s.type} />
                      {s.creditStatus && <StatusBadge status={s.creditStatus} />}
                      {s.voided && <Badge variant="destructive">Voided</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {s.customer?.name ?? s.customerName ?? "Walk-in"} ·{" "}
                      {s.items.reduce((a, i) => a + i.quantity, 0)} units · {timeAgo(s.createdAt)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">{formatCurrency(s.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Reveal>

      {/* Quick actions */}
      <Reveal>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quick.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="glass-card glow-hover flex flex-col items-center gap-2 rounded-2xl p-4 text-center text-sm font-medium transition-transform hover:-translate-y-0.5"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-glow">
                <a.icon className="size-5" />
              </span>
              {a.label}
            </Link>
          ))}
        </div>
      </Reveal>
    </div>
  );
}
