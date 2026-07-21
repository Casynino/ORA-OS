import Link from "next/link";
import {
  ShoppingCart,
  PlusCircle,
  UserPlus,
  Contact,
  Package,
  Receipt,
  MapPin,
  CreditCard,
  ClipboardList,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { getRepOverview } from "@/lib/services/field";
import { StatCard } from "@/components/ui/stat-card";
import { DonutChart } from "@/components/ui/charts";
import { Reveal } from "@/components/ui/reveal";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Large, always-visible quick actions — the rep's daily workflow. */
const ACTIONS: { href: string; label: string; icon: LucideIcon; tint: string }[] = [
  { href: "/rep/sell", label: "Record sale", icon: ShoppingCart, tint: "bg-primary/10 text-primary" },
  { href: "/rep/stock/request", label: "Request stock", icon: PlusCircle, tint: "bg-accent/10 text-accent" },
  { href: "/rep/customers/new", label: "Register customer", icon: UserPlus, tint: "bg-success/10 text-success" },
  { href: "/rep/customers", label: "My customers", icon: Contact, tint: "bg-info/10 text-info" },
  { href: "/rep/stock", label: "My stock", icon: Package, tint: "bg-warning/10 text-warning" },
  { href: "/rep/collections", label: "Record payment", icon: Receipt, tint: "bg-success/10 text-success" },
  { href: "/rep/reports", label: "Daily report", icon: MapPin, tint: "bg-primary/10 text-primary" },
];

/** Compact TSh (keeps big money readable inside small spaces like the donut centre). */
const compactTsh = (v: number) =>
  v >= 1_000_000
    ? `TSh ${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`
    : v >= 1_000
      ? `TSh ${Math.round(v / 1_000)}K`
      : `TSh ${formatNumber(v)}`;

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

  // At-a-glance = operational counts only (money lives in the hero, so nothing overflows).
  const summary = [
    { label: "My current stock", value: `${formatNumber(d.stockInHand)} pcs`, icon: Package, accent: "info" as const, href: "/rep/stock" },
    { label: "My customers", value: formatNumber(d.customersCount), icon: Contact, accent: "primary" as const, href: "/rep/customers" },
    { label: "Pending stock requests", value: formatNumber(d.pendingStockRequests), icon: ClipboardList, accent: (d.pendingStockRequests > 0 ? "warning" : "success") as "warning" | "success", href: "/rep/stock/requests" },
    { label: "Pending collections", value: formatNumber(d.openCreditCount), icon: CreditCard, accent: (d.openCreditCount > 0 ? "warning" : "success") as "warning" | "success", href: "/rep/collections" },
  ];

  // Sales mix donut — cash vs credit this month.
  const mix = [
    { label: "Cash sales", value: d.cashSalesMonth, color: "hsl(var(--success))" },
    { label: "Credit sales", value: d.creditSalesMonth, color: "hsl(var(--warning))" },
  ].filter((s) => s.value > 0);
  const cashShare = d.salesMonth > 0 ? Math.round((d.cashSalesMonth / d.salesMonth) * 100) : 0;

  // Greeting + date (Tanzania time, EAT) — matches the Admin/Finance/Warehouse banners.
  const eatHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Dar_es_Salaam", hour: "2-digit", hour12: false }).format(new Date()),
  );
  const greeting = eatHour >= 5 && eatHour < 12 ? "Good morning" : eatHour >= 12 && eatHour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Dar_es_Salaam",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
  const firstName = me.name?.split(" ")[0] ?? "Rep";

  return (
    <div className="space-y-6">
      {/* ── Hero — same premium banner as the other roles ── */}
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-accent to-primary p-5 text-white shadow-glow sm:p-8">
          <div className="absolute inset-0 bg-grid opacity-20" />
          <div className="pointer-events-none absolute -right-12 -top-16 size-56 rounded-full bg-white/15 blur-3xl animate-float-slow" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 size-48 rounded-full bg-white/10 blur-3xl animate-float-slow-rev" />
          <div className="relative min-w-0">
            <p className="flex items-center gap-2 text-xs text-white/80 sm:text-sm">
              <span className="inline-block size-2 shrink-0 animate-pulse rounded-full bg-white" />
              <span className="min-w-0 truncate">{dateLabel}</span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold">Sales Rep</span>
            </p>
            <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight sm:text-4xl">
              {greeting}, {firstName} 👋
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-white/90 sm:text-base">
              Record your sales, look after your customers, and stay on top of every shilling you collect.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:gap-8">
              <HeroStat label="Today so far" value={formatCurrency(d.salesToday)} sub="sales recorded today" />
              <HeroStat label="Sales this month" value={formatCurrency(d.salesMonth)} sub="your running total" />
              <HeroStat
                label="Credit to collect"
                value={formatCurrency(d.creditOutstanding)}
                sub={d.overdueCount > 0 ? `${d.openCreditCount} open · ${d.overdueCount} overdue` : `${d.openCreditCount} open · none overdue`}
              />
              <HeroStat label="Stock on hand" value={`${formatNumber(d.stockInHand)} pcs`} sub="ready to sell" />
            </div>
          </div>
        </div>
      </Reveal>

      {/* Quick actions — always at the top */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {ACTIONS.map((a) => (
            <Link
              key={a.href + a.label}
              href={a.href}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center shadow-soft transition-transform hover:-translate-y-0.5 hover:border-primary/40"
            >
              <span className={cn("flex size-11 items-center justify-center rounded-xl", a.tint)}>
                <a.icon className="size-5" />
              </span>
              <span className="text-sm font-medium leading-tight">{a.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Quick summary — operational counts */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          At a glance
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {summary.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.03}>
              {s.href ? (
                <Link href={s.href} className="block transition-transform hover:-translate-y-0.5">
                  <StatCard label={s.label} value={s.value} icon={s.icon} accent={s.accent} />
                </Link>
              ) : (
                <StatCard label={s.label} value={s.value} icon={s.icon} accent={s.accent} />
              )}
            </Reveal>
          ))}
        </div>
      </section>

      {/* Sales performance — cash vs credit donut + credit to collect */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sales performance · this month
        </h2>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Sales mix</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Cash vs credit
              </span>
            </div>
            {mix.length > 0 ? (
              <div className="mt-5">
                <DonutChart
                  segments={mix}
                  centerLabel={`${cashShare}% cash`}
                  centervalue={<span className="text-base sm:text-lg">{compactTsh(d.salesMonth)}</span>}
                  formatValue={(v) => formatCurrency(v)}
                />
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">No sales recorded yet this month.</p>
            )}
          </div>

          <Link
            href="/rep/collections"
            className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-soft transition-transform hover:-translate-y-0.5 hover:border-primary/40"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">Credit still to collect</span>
              <CreditCard className={cn("size-4", d.creditOutstanding > 0 ? "text-warning" : "text-success")} />
            </div>
            <p className="mt-2 font-display text-2xl font-bold sm:text-3xl">{formatCurrency(d.creditOutstanding)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {d.openCreditCount} open · {d.overdueCount > 0 ? `${d.overdueCount} overdue — chase now` : "none overdue"}
            </p>
            <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-medium text-primary">
              Go to collections <ArrowRight className="size-4" />
            </span>
          </Link>
        </div>
      </section>

      {/* Monthly targets */}
      {targets.length > 0 && (
        <Reveal>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Monthly targets</h2>
              <Link href="/rep/targets" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Details <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {targets.map((x) => {
                const pct = Math.min(100, Math.round((x.done / x.goal) * 100));
                return (
                  <div key={x.label}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{x.label}</span>
                      <span className="font-semibold">
                        {x.money ? formatCurrency(x.done) : formatNumber(x.done)}
                        <span className="text-muted-foreground">
                          {" / "}
                          {x.money ? formatCurrency(x.goal) : formatNumber(x.goal)}
                        </span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", pct >= 100 ? "bg-success" : "bg-primary")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>
      )}
    </div>
  );
}

/** Hero KPI — white-on-gradient, matches the Finance/Warehouse banners. */
function HeroStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-white/70">{label}</p>
      <p className="mt-0.5 truncate font-display text-xl font-bold sm:text-2xl">{value}</p>
      <p className="truncate text-[11px] text-white/70">{sub}</p>
    </div>
  );
}
