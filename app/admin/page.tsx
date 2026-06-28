import Link from "next/link";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import {
  Package,
  Warehouse as WIcon,
  Users,
  CreditCard,
  TrendingUp,
  Wallet,
  Coins,
  Clock,
  Truck,
  Undo2,
  ArrowLeftRight,
  UserPlus,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  UserCheck,
  AlertTriangle,
  Boxes,
  Star,
  TrendingDown,
  PackageX,
  Repeat,
  ShoppingCart,
  PackagePlus,
  FileBarChart,
  Banknote,
  Bell,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { getCommandCenter } from "@/lib/services/command-center";
import { productMeta } from "@/lib/product-meta";
import { KpiCard } from "@/components/admin/kpi-card";
import { Reveal } from "@/components/ui/reveal";
import { StatusBadge } from "@/components/ui/status-badge";
import { BarChart, DonutChart } from "@/components/ui/charts";
import { QueueApprove } from "@/components/admin/queue-approve";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatCurrency, formatNumber, timeAgo } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "hsl(38 95% 60%)",
  PRICED: "hsl(217 91% 60%)",
  APPROVED: "hsl(145 65% 52%)",
  IN_TRANSIT: "hsl(199 89% 55%)",
  FULFILLED: "hsl(322 100% 65%)",
  REJECTED: "hsl(0 75% 60%)",
  CANCELLED: "hsl(280 6% 55%)",
};

const DIST_COLORS = [
  "hsl(145 65% 52%)",
  "hsl(199 89% 55%)",
  "hsl(251 100% 72%)",
  "hsl(280 60% 65%)",
  "hsl(38 95% 60%)",
  "hsl(322 100% 65%)",
];

export default async function AdminCommandCenter() {
  await requireRole("ADMIN");

  const [d, queue] = await Promise.all([
    getCommandCenter(),
    Promise.all([
      prisma.request.findMany({
        where: { status: { in: ["PENDING", "PRICED"] } },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { requester: true, items: true },
      }),
      prisma.returnRequest.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 3,
        include: { product: true, requester: true },
      }),
      prisma.user.findMany({
        where: { role: "PARTNER", status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
    ]),
  ]);
  const [pendingRequests, pendingReturns, pendingApplications] = queue;

  // Greeting + date (Tanzania time, EAT)
  const eatHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Dar_es_Salaam",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
  const greeting =
    eatHour >= 5 && eatHour < 12
      ? "Good morning"
      : eatHour >= 12 && eatHour < 17
        ? "Good afternoon"
        : "Good evening";
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Dar_es_Salaam",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const inv = d.inventory;
  const distTotal = inv.distribution.reduce((s, x) => s + x.units, 0) || 1;
  const pipeline = d.statusPipeline
    .map((s) => ({
      label: s.status.charAt(0) + s.status.slice(1).toLowerCase(),
      value: s.count,
      color: STATUS_COLORS[s.status] ?? "hsl(280 6% 55%)",
    }))
    .filter((s) => s.value > 0);
  const pipelineTotal = pipeline.reduce((s, x) => s + x.value, 0);

  const queueTotal =
    d.operations.pendingApprovals +
    d.operations.pendingReturns +
    d.operations.pendingApplications;

  return (
    <div className="space-y-6">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-accent to-primary p-5 text-white shadow-glow sm:p-8">
          <div className="absolute inset-0 bg-grid opacity-20" />
          <div className="pointer-events-none absolute -right-12 -top-16 size-56 rounded-full bg-white/15 blur-3xl animate-float-slow" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 size-48 rounded-full bg-white/10 blur-3xl animate-float-slow-rev" />
          <div className="relative min-w-0">
            <p className="flex items-center gap-2 text-xs text-white/80 sm:text-sm">
              <span className="inline-block size-2 shrink-0 animate-pulse rounded-full bg-white" />
              <span className="min-w-0 truncate">{dateLabel}</span>
            </p>
            <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight sm:text-4xl">
              {greeting}.
            </h1>
            <p className="mt-1.5 text-sm text-white/90 sm:text-base">
              Welcome back. Here&apos;s what&apos;s happening across ORA today.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:gap-8">
              <HeroStat label="Cash collected today" value={formatCurrency(d.finance.cashToday)} />
              <HeroStat label="Revenue today" value={formatCurrency(d.sales.today.revenue)} />
              <HeroStat label="Revenue this month" value={formatCurrency(d.sales.month.revenue)} />
              <HeroStat label="Outstanding credit" value={formatCurrency(d.finance.outstandingCredit)} />
              <HeroStat label="Total donated" value={formatCurrency(d.sales.donations)} />
            </div>
          </div>
        </div>
      </Reveal>

      {/* ── Alerts ───────────────────────────────────────────── */}
      {d.alerts.length > 0 && (
        <Reveal>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Bell className="size-3.5" /> Needs attention
            </span>
            {d.alerts.map((a, i) => (
              <Link
                key={i}
                href={a.href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  a.tone === "danger" &&
                    "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15",
                  a.tone === "warning" &&
                    "border-warning/30 bg-warning/10 text-warning hover:bg-warning/15",
                  a.tone === "info" &&
                    "border-info/30 bg-info/10 text-info hover:bg-info/15",
                )}
              >
                <CircleDot className="size-3" />
                {a.text}
              </Link>
            ))}
          </div>
        </Reveal>
      )}

      {/* ── Inventory: where every unit is ───────────────────── */}
      <section>
        <SectionLabel>Inventory · where every unit is</SectionLabel>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Reveal><KpiCard label="Total inventory" value={inv.total} suffix=" units" icon={Boxes} accent="primary" hint={`${formatNumber(inv.distributed)} distributed to date`} /></Reveal>
          <Reveal delay={0.05}><KpiCard label="Warehouse inventory" value={inv.warehouse} suffix=" units" icon={WIcon} accent="info" hint="available in warehouses" /></Reveal>
          <Reveal delay={0.1}><KpiCard label="With partners" value={inv.partner} suffix=" units" icon={Users} accent="accent" hint="committed to partner orders" /></Reveal>
          <Reveal delay={0.15}><KpiCard label="On credit" value={inv.credit} suffix=" units" icon={CreditCard} accent="warning" hint="held by partners, owed to ORA" /></Reveal>
        </div>

        {/* Distribution */}
        <Reveal>
          <div className="glass-card mt-4 rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold">Inventory distribution</h3>
              <span className="text-sm text-muted-foreground">{formatNumber(distTotal)} units placed</span>
            </div>
            <div className="mt-4 flex h-3 overflow-hidden rounded-full">
              {inv.distribution.map((b, i) => (
                <div key={b.label} style={{ width: `${(b.units / distTotal) * 100}%`, background: DIST_COLORS[i % DIST_COLORS.length] }} title={`${b.label}: ${b.units}`} />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {inv.distribution.map((b, i) => (
                <div key={b.label}>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full" style={{ background: DIST_COLORS[i % DIST_COLORS.length] }} />
                    <span className="truncate text-xs text-muted-foreground">{b.label}</span>
                  </div>
                  <p className="mt-0.5 font-display text-lg font-bold">{formatNumber(b.units)}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Sales ────────────────────────────────────────────── */}
      <section>
        <SectionLabel>Sales</SectionLabel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MiniStat icon={TrendingUp} accent="success" label="Sales today" value={formatCurrency(d.sales.today.revenue)} hint={`${d.sales.today.orders} order${d.sales.today.orders === 1 ? "" : "s"}`} />
          <MiniStat icon={TrendingUp} accent="success" label="This week" value={formatCurrency(d.sales.week.revenue)} hint={`${d.sales.week.orders} order${d.sales.week.orders === 1 ? "" : "s"}`} />
          <MiniStat icon={TrendingUp} accent="success" label="This month" value={formatCurrency(d.sales.month.revenue)} hint={`${d.sales.month.orders} order${d.sales.month.orders === 1 ? "" : "s"}`} />
          <MiniStat icon={ShoppingCart} accent="info" label="Avg order value" value={formatCurrency(d.sales.avgOrderValue)} hint="this month" />
          <MiniStat icon={Star} accent="accent" label="Top partner" value={d.sales.topPartner?.name ?? "—"} hint={d.sales.topPartner ? formatCurrency(d.sales.topPartner.value) : "no sales yet"} small />
        </div>
      </section>

      {/* ── Credit & finance ─────────────────────────────────── */}
      <section>
        <SectionLabel>Credit &amp; finance</SectionLabel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MiniStat icon={Wallet} accent="warning" label="Outstanding credit" value={formatCurrency(d.finance.outstandingCredit)} hint="owed by partners" />
          <MiniStat icon={CreditCard} accent="info" label="Active credit accounts" value={formatNumber(d.finance.activeCreditAccounts)} hint="partners on credit" />
          <MiniStat icon={Banknote} accent="success" label="Collections this month" value={formatCurrency(d.finance.collectionsMonth)} hint="repayments received" />
          <MiniStat icon={AlertTriangle} accent={d.finance.overdueCredit > 0 ? "warning" : "success"} label="Overdue credit" value={formatCurrency(d.finance.overdueCredit)} hint={`${d.finance.overdueCount} partner${d.finance.overdueCount === 1 ? "" : "s"}`} />
          <MiniStat icon={Coins} accent="primary" label="Cash collected today" value={formatCurrency(d.finance.cashToday)} hint="sales + repayments" />
        </div>
      </section>

      {/* ── Operations ───────────────────────────────────────── */}
      <section>
        <SectionLabel>Operations · needs action</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <OpTile icon={UserPlus} label="Applications" value={d.operations.pendingApplications} href="/admin/users" />
          <OpTile icon={Clock} label="Order approvals" value={d.operations.pendingApprovals} href="/admin/requests" />
          <OpTile icon={PackagePlus} label="Ready to fulfil" value={d.operations.readyForFulfillment} href="/admin/requests" />
          <OpTile icon={Truck} label="In transit" value={d.operations.inTransitOrders} href="/admin/requests" />
          <OpTile icon={Undo2} label="Pending returns" value={d.operations.pendingReturns} href="/admin/returns" />
          <OpTile icon={ArrowLeftRight} label="Transfers active" value={d.operations.transfersInProgress} href="/admin/transfers" />
        </div>
      </section>

      {/* ── Quick actions ────────────────────────────────────── */}
      <section>
        <SectionLabel>Quick actions</SectionLabel>
        <div className="flex flex-wrap gap-2">
          <QuickAction icon={CheckCircle2} label="Approve orders" href="/admin/requests" />
          <QuickAction icon={UserCheck} label="Applications" href="/admin/users" />
          <QuickAction icon={ArrowLeftRight} label="New transfer" href="/admin/transfers" />
          <QuickAction icon={Banknote} label="Record payment" href="/admin/credit" />
          <QuickAction icon={PackagePlus} label="Receive stock" href="/admin/imports" />
          <QuickAction icon={Package} label="Inventory" href="/admin/inventory" />
          <QuickAction icon={FileBarChart} label="Reports" href="/admin/profit" />
        </div>
      </section>

      {/* ── Charts ───────────────────────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Reveal>
          <TrendCard title="Sales trend" caption={formatCurrency(d.sales.month.revenue) + " this month"} data={d.trends.sales} color="hsl(145 65% 52%)" />
        </Reveal>
        <Reveal delay={0.05}>
          <TrendCard title="Cash collections" caption={formatCurrency(d.finance.collectionsMonth) + " this month"} data={d.trends.collections} color="hsl(199 89% 55%)" />
        </Reveal>
        <Reveal delay={0.1}>
          <TrendCard title="Partner growth" caption={`${formatNumber(d.operations.activePartners)} active partners`} data={d.trends.partners} color="hsl(251 100% 72%)" valueMode="count" />
        </Reveal>
      </section>

      {/* ── Warehouse overview ───────────────────────────────── */}
      <Reveal>
        <div className="glass-card rounded-2xl p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 font-display font-semibold">
              <WIcon className="size-4" /> Warehouse overview
            </h3>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Boxes className="size-3.5" /> {formatCurrency(d.network.value)} value</span>
              <span className="inline-flex items-center gap-1.5"><ArrowLeftRight className="size-3.5" /> {d.network.transfersInProgress} transfers</span>
              <Link href="/admin/warehouses" className={buttonVariants({ variant: "ghost", size: "sm" })}>Manage <ArrowRight className="size-4" /></Link>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {d.warehouses.map((w) => (
              <Link key={w.id} href={`/admin/warehouses/${w.id}`} className="rounded-xl border border-border/60 p-4 transition hover:border-primary/40 hover:bg-muted/30">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{w.name}</p>
                  <StatusBadge status={w.status} />
                </div>
                <div className="mt-2 flex items-end justify-between">
                  <span className="font-display text-xl font-semibold">{formatNumber(w.onHand)}<span className="ml-1 text-xs font-normal text-muted-foreground">units</span></span>
                  <span className="text-xs text-muted-foreground">{formatCurrency(w.value)}</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                  <span className="truncate">{w.activeOrders} orders</span>
                  <span className="truncate text-center">↓{w.transfersIn} ↑{w.transfersOut}</span>
                  <span className={cn("truncate text-right", w.lowStock > 0 && "text-warning")}>{w.lowStock > 0 ? `${w.lowStock} low` : "stocked"}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ── Product performance ──────────────────────────────── */}
      <section>
        <SectionLabel>Product performance</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <ProductPerf icon={Star} accent="text-success" title="Best seller" p={d.productPerformance.best} />
          <ProductPerf icon={TrendingDown} accent="text-muted-foreground" title="Slow mover" p={d.productPerformance.slow} />
          <ProductPerf icon={PackageX} accent="text-warning" title="Lowest stock" p={d.productPerformance.low} />
          <ProductPerf icon={Repeat} accent="text-info" title="Most returned" p={d.productPerformance.returned} />
          <ProductPerf icon={ShoppingCart} accent="text-primary" title="Most requested" p={d.productPerformance.requested} />
        </div>
      </section>

      {/* ── Approval queue + Live activity ───────────────────── */}
      <div id="queue" className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Reveal>
          <div className="glass-card rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold">Approval queue</h3>
              <span className="flex items-center gap-1.5 text-xs font-medium text-warning">
                <CircleDot className="size-3.5" /> {queueTotal} waiting
              </span>
            </div>
            {queueTotal === 0 ? (
              <EmptyState className="mt-4" icon={CheckCircle2} title="All clear" description="No actions are waiting for approval." />
            ) : (
              <div className="mt-4 space-y-2">
                {pendingRequests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="size-4 shrink-0 text-warning" />
                        <p className="truncate text-sm font-medium">{r.code} · {r.requester.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Stock order · {r.items.length} items · {timeAgo(r.createdAt)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={r.status} />
                      <Link href="/admin/requests" className={buttonVariants({ size: "sm", variant: "outline" })}>Review</Link>
                    </div>
                  </div>
                ))}
                {pendingReturns.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Undo2 className="size-4 shrink-0 text-info" />
                        <p className="truncate text-sm font-medium">{r.code} · {r.product.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Return · {r.quantity} units · {r.requester.name}</p>
                    </div>
                    <QueueApprove kind="return" id={r.id} />
                  </div>
                ))}
                {pendingApplications.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <UserCheck className="size-4 shrink-0 text-accent" />
                        <p className="truncate text-sm font-medium">{u.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Partner application{u.organization ? ` · ${u.organization}` : ""}</p>
                    </div>
                    <QueueApprove kind="application" id={u.id} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="glass-card rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold">Live activity</h3>
              <span className="flex items-center gap-1.5 text-xs font-medium text-success">
                <span className="size-1.5 animate-pulse rounded-full bg-success" /> Live
              </span>
            </div>
            <div className="mt-4 space-y-3.5">
              {d.recentActivity.length === 0 ? (
                <EmptyState icon={ClipboardList} title="Nothing yet" />
              ) : (
                d.recentActivity.map((a) => (
                  <div key={a.id} className="flex gap-3">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-gradient-to-br from-primary to-accent" />
                    <div className="min-w-0">
                      <p className="text-sm leading-snug">{a.summary}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(a.createdAt)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Reveal>
      </div>

      {/* ── Today's orders + request pipeline ────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Reveal>
          <div className="glass-card rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold">Partners who ordered today</h3>
              <Link href="/admin/sales" className={buttonVariants({ variant: "ghost", size: "sm" })}>All sales <ArrowRight className="size-4" /></Link>
            </div>
            <div className="mt-4 space-y-2">
              {d.todaysOrders.length === 0 ? (
                <EmptyState icon={ShoppingCart} title="No orders yet today" description="Fulfilled partner orders will appear here through the day." />
              ) : (
                d.todaysOrders.map((o) => (
                  <div key={o.code} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{o.name}</p>
                      <p className="text-xs text-muted-foreground">{o.org ?? "Partner"} · {o.code}</p>
                    </div>
                    <span className="shrink-0 font-display font-semibold">{formatCurrency(o.value)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="glass-card rounded-2xl p-5 sm:p-6">
            <h3 className="font-display font-semibold">Order pipeline</h3>
            <div className="mt-4">
              {pipelineTotal > 0 ? (
                <DonutChart segments={pipeline} centervalue={formatNumber(pipelineTotal)} centerLabel="orders" />
              ) : (
                <EmptyState icon={ClipboardList} title="No orders yet" />
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

/* ── helper components ───────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] uppercase tracking-wide text-white/70">{label}</p>
      <p className="truncate font-display text-xl font-bold sm:text-2xl">{value}</p>
    </div>
  );
}

const MINI_ACCENT: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/12 text-accent",
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-warning",
  info: "bg-info/12 text-info",
};

function MiniStat({
  icon: Icon,
  label,
  value,
  hint,
  accent = "primary",
  small,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  accent?: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", MINI_ACCENT[accent])}>
          <Icon className="size-3.5" />
        </span>
      </div>
      <p className={cn("mt-2 font-display font-bold tracking-tight", small ? "truncate text-base" : "text-xl sm:text-2xl")}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function OpTile({ icon: Icon, label, value, href }: { icon: LucideIcon; label: string; value: number; href: string }) {
  const active = value > 0;
  return (
    <Link
      href={href}
      className={cn(
        "rounded-2xl border p-4 transition-colors",
        active ? "border-warning/30 bg-warning/5 hover:bg-warning/10" : "border-border bg-card hover:bg-muted/40",
      )}
    >
      <div className="flex items-center justify-between">
        <Icon className={cn("size-4", active ? "text-warning" : "text-muted-foreground")} />
        <span className="font-display text-2xl font-bold">{formatNumber(value)}</span>
      </div>
      <p className="mt-1 truncate text-xs text-muted-foreground">{label}</p>
    </Link>
  );
}

function QuickAction({ icon: Icon, label, href }: { icon: LucideIcon; label: string; href: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-medium shadow-soft transition-colors hover:border-primary/40 hover:bg-muted/40">
      <Icon className="size-4 text-primary" />
      {label}
    </Link>
  );
}

function TrendCard({
  title,
  caption,
  data,
  color,
  valueMode = "money",
}: {
  title: string;
  caption: string;
  data: { label: string; value: number }[];
  color: string;
  valueMode?: "money" | "count";
}) {
  const bars = data.map((b) => ({
    label: b.label,
    value: valueMode === "money" ? Math.round(b.value / 1000) : b.value,
    color,
  }));
  const hasData = bars.some((b) => b.value > 0);
  return (
    <div className="glass-card flex h-full flex-col rounded-2xl p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display font-semibold">{title}</h3>
        {valueMode === "money" && <span className="text-[10px] uppercase tracking-wide text-muted-foreground">TSh ’000</span>}
      </div>
      <p className="mt-0.5 text-sm text-muted-foreground">{caption}</p>
      <div className="mt-4 flex-1">
        {hasData ? (
          <BarChart data={bars} height={140} showValues={false} />
        ) : (
          <div className="flex h-[140px] items-center justify-center text-sm text-muted-foreground">No data yet</div>
        )}
      </div>
    </div>
  );
}

function ProductPerf({
  icon: Icon,
  accent,
  title,
  p,
}: {
  icon: LucideIcon;
  accent: string;
  title: string;
  p: { name: string; sku: string; qty: number; caption: string } | null | undefined;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <div className="relative aspect-[4/3] bg-muted">
        {p && (
          <Image src={productMeta(p.sku).image} alt={p.name} fill sizes="200px" className="object-cover" />
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
          <Icon className={cn("size-3", accent)} /> {title}
        </span>
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-medium">{p?.name ?? "—"}</p>
        <p className="text-xs text-muted-foreground">
          {p ? `${formatNumber(p.qty)} ${p.caption}` : "no data"}
        </p>
      </div>
    </div>
  );
}
