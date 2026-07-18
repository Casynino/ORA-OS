import Link from "next/link";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import {
  Wallet, CreditCard, TrendingUp, Scale, ArrowRight, Star, PackageX,
  TrendingDown, Boxes, ShoppingCart, ChevronRight, RotateCcw,
  FileBarChart, Users, ShieldAlert, Package, ScrollText,
  UserPlus, ClipboardList, BadgeCheck, Receipt, PackagePlus, Truck, Undo2, ArrowLeftRight,
} from "lucide-react";
import type { CustomerIntelligence } from "@/lib/services/intelligence";
import { KpiCard } from "@/components/admin/kpi-card";
import { productMeta } from "@/lib/product-meta";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>
      {action}
    </div>
  );
}

// ── 2 · Business health summary — the 10-second picture (each number once) ────

export function BusinessHealth({
  cashAvailable, outstandingCredit, revenueMonth, netProfit,
}: {
  cashAvailable: number; outstandingCredit: number; revenueMonth: number; netProfit: number;
}) {
  return (
    <section>
      <SectionLabel>Business health · right now</SectionLabel>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Cash available" value={cashAvailable} prefix="TSh " icon={Wallet} accent="primary" hint="money to run ORA" />
        <KpiCard label="Owed by customers" value={outstandingCredit} prefix="TSh " icon={CreditCard} accent="warning" hint="outstanding credit" />
        <KpiCard label="Revenue this month" value={revenueMonth} prefix="TSh " icon={TrendingUp} accent="info" hint="total sales generated" />
        <KpiCard label="Net profit this month" value={netProfit} prefix="TSh " icon={Scale} accent={netProfit >= 0 ? "success" : "warning"} hint={netProfit >= 0 ? "in the black" : "operating at a loss"} />
      </div>
    </section>
  );
}

// ── 3 · Needs attention — the consolidated action center ─────────────────────

export type AttentionItem = {
  tone: "danger" | "warning" | "info";
  icon: LucideIcon;
  label: string;
  hint: string;
  href: string;
};

const ATTN_TONE: Record<AttentionItem["tone"], string> = {
  danger: "border-destructive/30 bg-destructive/[0.05] text-destructive",
  warning: "border-warning/30 bg-warning/[0.05] text-warning",
  info: "border-info/25 bg-info/[0.04] text-info",
};
const ATTN_RANK: Record<AttentionItem["tone"], number> = { danger: 0, warning: 1, info: 2 };

export function NeedsAttention({ items }: { items: AttentionItem[] }) {
  const sorted = [...items].sort((a, b) => ATTN_RANK[a.tone] - ATTN_RANK[b.tone]);
  return (
    <section>
      <SectionLabel>Needs your attention</SectionLabel>
      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-success/25 bg-success/[0.04] p-5 text-sm text-success">
          All clear — nothing needs your attention right now.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((a, i) => (
            <Link
              key={i}
              href={a.href}
              className={cn(
                "group flex items-center gap-3 rounded-2xl border p-4 shadow-soft transition-all hover:-translate-y-0.5",
                ATTN_TONE[a.tone],
              )}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background/60">
                <a.icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{a.label}</p>
                <p className="truncate text-xs text-muted-foreground">{a.hint}</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

// ── 3b · Executive quick links — jump to the pages a CEO acts from. The money
//        actions (record expense / issue funds / add capital) are rendered as
//        live modal buttons in the page alongside these. ──────────────────────

const EXEC_ACTIONS: { icon: LucideIcon; label: string; href: string }[] = [
  { icon: ClipboardList, label: "Approve orders", href: "/admin/requests" },
  { icon: PackagePlus, label: "Receive stock", href: "/admin/imports" },
  { icon: Package, label: "Inventory", href: "/admin/inventory" },
  { icon: FileBarChart, label: "Reports", href: "/admin/finance/profit" },
  { icon: Users, label: "Customers", href: "/admin/customers" },
  { icon: ShieldAlert, label: "Credit risk", href: "/admin/credit" },
  { icon: ScrollText, label: "General Ledger", href: "/admin/finance/ledger" },
];

export function ExecutiveActions() {
  return (
    <>
      {EXEC_ACTIONS.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-medium shadow-soft transition-colors hover:border-primary/40 hover:bg-muted/40"
        >
          <a.icon className="size-4 text-primary" />
          {a.label}
        </Link>
      ))}
    </>
  );
}

// ── 3c · Operations at a glance — the pipeline the CEO oversees ──────────────

export type OpsCounts = {
  pendingApplications: number; pendingApprovals: number; pendingRepRequests: number;
  pendingPayments: number; readyForFulfillment: number; inTransitOrders: number;
  pendingReturns: number; transfersInProgress: number;
};

export function OperationsStatus({ ops }: { ops: OpsCounts }) {
  const tiles: { icon: LucideIcon; label: string; value: number; href: string }[] = [
    { icon: UserPlus, label: "Applications", value: ops.pendingApplications, href: "/admin/users" },
    { icon: ClipboardList, label: "Order approvals", value: ops.pendingApprovals, href: "/admin/requests" },
    { icon: BadgeCheck, label: "Rep stock requests", value: ops.pendingRepRequests, href: "/admin/reps" },
    { icon: Receipt, label: "Payments to confirm", value: ops.pendingPayments, href: "/admin/requests" },
    { icon: PackagePlus, label: "Ready to fulfil", value: ops.readyForFulfillment, href: "/admin/requests" },
    { icon: Truck, label: "In transit", value: ops.inTransitOrders, href: "/admin/requests" },
    { icon: Undo2, label: "Pending returns", value: ops.pendingReturns, href: "/admin/returns" },
    { icon: ArrowLeftRight, label: "Transfers active", value: ops.transfersInProgress, href: "/admin/transfers" },
  ];
  return (
    <section>
      <SectionLabel>Operations · at a glance</SectionLabel>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {tiles.map((t) => {
          const active = t.value > 0;
          return (
            <Link
              key={t.label}
              href={t.href}
              className={cn(
                "rounded-2xl border p-4 transition-colors",
                active ? "border-warning/30 bg-warning/5 hover:bg-warning/10" : "border-border bg-card hover:bg-muted/40",
              )}
            >
              <div className="flex items-center justify-between">
                <t.icon className={cn("size-4", active ? "text-warning" : "text-muted-foreground")} />
                <span className="font-display text-2xl font-bold">{formatNumber(t.value)}</span>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">{t.label}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ── 4 · Revenue & collection overview — breakdown, not repeated totals ────────

export function RevenueCollectionOverview({
  cashRevenue, creditRevenue, collectedMonth, collectionRate, dueThisWeek, overdueTotal, overdueCount,
  activeCreditCustomers, goodPayers, atRiskCustomers,
}: {
  cashRevenue: number; creditRevenue: number; collectedMonth: number;
  collectionRate: number; dueThisWeek: number; overdueTotal: number; overdueCount: number;
  activeCreditCustomers: number; goodPayers: number; atRiskCustomers: number;
}) {
  const total = cashRevenue + creditRevenue;
  const cashPct = total > 0 ? (cashRevenue / total) * 100 : 0;
  const creditPct = total > 0 ? (creditRevenue / total) * 100 : 0;
  return (
    <section>
      <SectionLabel action={<Link href="/admin/credit" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Manage credit <ArrowRight className="size-3.5" /></Link>}>
        Revenue &amp; collections · this month
      </SectionLabel>
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Revenue split — the breakdown of the health headline, not a repeat */}
        <div className="glass-card rounded-2xl p-5 sm:p-6">
          <p className="text-sm font-medium">How this month&apos;s revenue splits</p>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-muted">
            <div className="bg-success" style={{ width: `${cashPct}%` }} title={`Cash ${formatCurrency(cashRevenue)}`} />
            <div className="bg-warning" style={{ width: `${creditPct}%` }} title={`Credit ${formatCurrency(creditRevenue)}`} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-success" />
                <span className="text-xs text-muted-foreground">Cash sales</span>
              </div>
              <p className="mt-0.5 font-display text-xl font-bold">{formatCurrency(cashRevenue)}</p>
              <p className="text-[11px] text-muted-foreground">{Math.round(cashPct)}% · paid on the spot</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-warning" />
                <span className="text-xs text-muted-foreground">Credit sales</span>
              </div>
              <p className="mt-0.5 font-display text-xl font-bold">{formatCurrency(creditRevenue)}</p>
              <p className="text-[11px] text-muted-foreground">{Math.round(creditPct)}% · to collect later</p>
            </div>
          </div>
        </div>
        {/* Collection health — distinct figures, no outstanding-total repeat */}
        <div className="glass-card rounded-2xl p-5 sm:p-6">
          <p className="text-sm font-medium">Bringing the money in</p>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
            <MiniFigure label="Collected this month" value={formatCurrency(collectedMonth)} tone="success" />
            <MiniFigure label="Collection rate" value={`${collectionRate}%`} tone="info" />
            <MiniFigure label="Due this week" value={formatCurrency(dueThisWeek)} tone="primary" />
            <MiniFigure label="Overdue" value={formatCurrency(overdueTotal)} tone={overdueTotal > 0 ? "danger" : "success"} hint={overdueCount > 0 ? `${overdueCount} past due` : "on track"} />
          </div>
          {/* Credit-book health — how the customers on credit are behaving */}
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border/60 pt-4">
            <div>
              <p className="font-display text-xl font-bold">{formatNumber(activeCreditCustomers)}</p>
              <p className="text-[11px] text-muted-foreground">on credit</p>
            </div>
            <div>
              <p className="font-display text-xl font-bold text-success">{formatNumber(goodPayers)}</p>
              <p className="text-[11px] text-muted-foreground">good standing</p>
            </div>
            <div>
              <p className={cn("font-display text-xl font-bold", atRiskCustomers > 0 ? "text-destructive" : "text-success")}>{formatNumber(atRiskCustomers)}</p>
              <p className="text-[11px] text-muted-foreground">at risk</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniFigure({ label, value, tone, hint }: { label: string; value: string; tone: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 font-display text-xl font-bold", {
        "text-success": tone === "success",
        "text-destructive": tone === "danger",
        "text-info": tone === "info",
      })}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── 5 · Inventory overview — clean summary, detail is one click away ──────────

const DIST_COLORS = ["hsl(145 65% 52%)", "hsl(199 89% 55%)", "hsl(251 100% 72%)", "hsl(38 95% 60%)"];

export type InventoryCounts = {
  total: number; warehouse: number; reps: number; partner: number; credit: number; distributed: number;
  distribution: { label: string; units: number }[];
};

export function InventoryOverview({ totalValue, inv }: { totalValue: number; inv: InventoryCounts }) {
  const distTotal = inv.distribution.reduce((s, x) => s + x.units, 0) || 1;
  // Where every unit sits — company-held (warehouse/reps/partners), with customers
  // on credit (delivered, still owed), and the running total distributed.
  const cells: { label: string; value: number; color: string | null }[] = [
    { label: "In warehouse", value: inv.warehouse, color: DIST_COLORS[0] },
    { label: "With sales reps", value: inv.reps, color: DIST_COLORS[1] },
    { label: "With partners", value: inv.partner, color: DIST_COLORS[2] },
    { label: "With customers · on credit", value: inv.credit, color: DIST_COLORS[3] },
    { label: "Distributed to date", value: inv.distributed, color: null },
  ];
  return (
    <section>
      <SectionLabel action={
        <span className="flex items-center gap-3">
          <Link href="/admin/warehouses" className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline">By warehouse</Link>
          <Link href="/admin/inventory" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Analytics <ArrowRight className="size-3.5" /></Link>
        </span>
      }>
        Inventory · where every unit is
      </SectionLabel>
      <div className="glass-card rounded-2xl p-4 sm:p-5">
        {/* headline: stock value + units, on one line */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="font-display text-2xl font-bold tracking-tight">
            {formatCurrency(totalValue)}
            <span className="ml-2 text-xs font-normal text-muted-foreground">stock value · at buying price</span>
          </p>
          <p className="text-sm text-muted-foreground">
            <Boxes className="mr-1.5 inline size-4" />{formatNumber(inv.total)} units in stock
          </p>
        </div>
        {/* thin distribution bar (current company-held locations) */}
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">
          {inv.distribution.map((b, i) => (
            <div key={b.label} style={{ width: `${(b.units / distTotal) * 100}%`, background: DIST_COLORS[i % DIST_COLORS.length] }} title={`${b.label}: ${b.units}`} />
          ))}
        </div>
        {/* compact per-location unit counts */}
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-5">
          {cells.map((c) => (
            <div key={c.label}>
              <div className="flex items-center gap-1.5">
                {c.color ? <span className="size-2 rounded-full" style={{ background: c.color }} /> : <span className="size-2 rounded-full bg-muted-foreground/40" />}
                <span className="truncate text-[11px] text-muted-foreground">{c.label}</span>
              </div>
              <p className="mt-0.5 font-display text-lg font-bold">{formatNumber(c.value)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── 6 · Sales performance — today's pulse (month lives in health) ────────────

type PeriodSplit = { revenue: number; cashRevenue: number; creditRevenue: number };

export function SalesPerformance({
  today, week, avgSale, topPartner,
}: {
  today: PeriodSplit; week: PeriodSplit; avgSale: number;
  topPartner: { name: string; value: number } | null;
}) {
  return (
    <section>
      <SectionLabel action={<Link href="/admin/sales" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">All sales <ArrowRight className="size-3.5" /></Link>}>
        Sales performance
      </SectionLabel>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SalesCard label="Sales today" value={today.revenue} cash={today.cashRevenue} credit={today.creditRevenue} />
        <SalesCard label="This week" value={week.revenue} cash={week.cashRevenue} credit={week.creditRevenue} />
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-muted-foreground">Avg sale value</span>
            <ShoppingCart className="size-4 text-info" />
          </div>
          <p className="mt-2 font-display text-xl font-bold tracking-tight sm:text-2xl">{formatCurrency(avgSale)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">this month</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-muted-foreground">Top partner</span>
            <Star className="size-4 text-accent" />
          </div>
          <p className="mt-2 truncate font-display text-base font-bold tracking-tight">{topPartner?.name ?? "—"}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{topPartner ? formatCurrency(topPartner.value) : "no sales yet"}</p>
        </div>
      </div>
    </section>
  );
}

function SalesCard({ label, value, cash, credit }: { label: string; value: number; cash: number; credit: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
        <TrendingUp className="size-4 text-success" />
      </div>
      <p className="mt-2 font-display text-xl font-bold tracking-tight sm:text-2xl">{formatCurrency(value)}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">
        Cash {formatCurrency(cash)} · Credit {formatCurrency(credit)}
      </p>
    </div>
  );
}

// ── 6b · Customer summary strip (compact; full analytics one click away) ─────

export function CustomerSummaryStrip({ cust }: { cust: CustomerIntelligence }) {
  const cells = [
    { label: "Total", value: cust.total },
    { label: "Active", value: cust.activeThisMonth },
    { label: "On credit", value: cust.creditCustomers },
    { label: "Cash only", value: cust.cashCustomers },
    { label: "New", value: cust.newThisMonth },
    { label: "Partners", value: cust.partners },
  ];
  return (
    <section>
      <SectionLabel action={<Link href="/admin/customers" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Customer analytics <ArrowRight className="size-3.5" /></Link>}>
        Customers · who ORA sells to
      </SectionLabel>
      <div className="grid grid-cols-3 gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft sm:grid-cols-6">
        {cells.map((c) => (
          <div key={c.label} className="text-center sm:text-left">
            <p className="font-display text-2xl font-bold tracking-tight">{formatNumber(c.value)}</p>
            <p className="truncate text-xs text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── 7 · Product performance — visual product intelligence ────────────────────

type Perf = { name: string; sku: string; qty: number; caption: string } | null | undefined;

export function ProductPerformance({
  best, slow, low, returned, requested,
}: {
  best: Perf; slow: Perf; low: Perf; returned: Perf; requested: Perf;
}) {
  const items: { icon: LucideIcon; accent: string; title: string; p: Perf }[] = [
    { icon: Star, accent: "text-success", title: "Best seller", p: best },
    { icon: TrendingDown, accent: "text-muted-foreground", title: "Slow mover", p: slow },
    { icon: PackageX, accent: "text-warning", title: "Lowest stock", p: low },
    { icon: RotateCcw, accent: "text-info", title: "Most returned", p: returned },
    { icon: ShoppingCart, accent: "text-primary", title: "Most requested", p: requested },
  ];
  return (
    <section>
      <SectionLabel action={<Link href="/admin/products" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">All products <ArrowRight className="size-3.5" /></Link>}>
        Product performance
      </SectionLabel>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((it) => (
          <div key={it.title} className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            <div className="relative aspect-[4/3] bg-muted">
              {it.p && <Image src={productMeta(it.p.sku).image} alt={it.p.name} fill sizes="220px" className="object-cover" />}
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                <it.icon className={cn("size-3", it.accent)} /> {it.title}
              </span>
            </div>
            <div className="p-3">
              <p className="truncate text-sm font-medium">{it.p?.name ?? "—"}</p>
              <p className="truncate text-xs text-muted-foreground">{it.p ? `${formatNumber(it.p.qty)} ${it.p.caption}` : "no data"}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
