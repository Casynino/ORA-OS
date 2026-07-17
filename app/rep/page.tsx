import Link from "next/link";
import {
  ShoppingCart,
  PlusCircle,
  UserPlus,
  Contact,
  Package,
  Receipt,
  MapPin,
  TrendingUp,
  Wallet,
  CreditCard,
  ClipboardList,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { getRepOverview } from "@/lib/services/field";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";
import { buttonVariants } from "@/components/ui/button";
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

  const summary = [
    { label: "My current stock", value: `${formatNumber(d.stockInHand)} pcs`, icon: Package, accent: "info" as const, href: "/rep/stock" },
    { label: "My customers", value: formatNumber(d.customersCount), icon: Contact, accent: "primary" as const, href: "/rep/customers" },
    { label: "Pending stock requests", value: formatNumber(d.pendingStockRequests), icon: ClipboardList, accent: (d.pendingStockRequests > 0 ? "warning" : "success") as "warning" | "success", href: "/rep/stock/requests" },
    { label: "Pending collections", value: formatNumber(d.openCreditCount), icon: CreditCard, accent: (d.openCreditCount > 0 ? "warning" : "success") as "warning" | "success", href: "/rep/collections" },
    { label: "Sales today", value: formatCurrency(d.salesToday), icon: TrendingUp, accent: "accent" as const },
    { label: "Sales this month", value: formatCurrency(d.salesMonth), icon: Wallet, accent: "success" as const },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-accent/10 p-5 shadow-soft sm:p-6">
          <div className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-3">
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
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Today so far</p>
              <p className="font-display text-2xl font-bold">{formatCurrency(d.salesToday)}</p>
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

      {/* Quick summary */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          At a glance
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
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
