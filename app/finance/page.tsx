import Link from "next/link";
import {
  Banknote,
  Landmark,
  ArrowDownToLine,
  ArrowUpFromLine,
  CreditCard,
  Receipt,
  TrendingUp,
  TrendingDown,
  ClipboardCheck,
  AlertTriangle,
  ChevronRight,
  BadgeCheck,
  UserCheck,
  Users,
  PieChart,
  type LucideIcon,
} from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getFinanceOverview, getLedger } from "@/lib/services/finance";
import { getOperationalFundBalance } from "@/lib/services/operational-fund";
import { getCollectionsIntelligence } from "@/lib/services/intelligence";
import { getCashSummary } from "@/lib/services/cash";
import { CollectionsAndCredit } from "@/components/admin/command-sections";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DonutChart } from "@/components/ui/charts";
import { DashboardHero } from "@/components/ui/dashboard-hero";
import { Reveal } from "@/components/ui/reveal";
import { cn, formatCurrency, formatNumber, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DONUT_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--info))",
  "hsl(var(--warning))",
  "hsl(var(--success))",
  "hsl(280 6% 55%)",
];

/** The Finance & Accounting dashboard — a premium financial workspace. */
export default async function FinanceDashboardPage() {
  const me = await requireRole("FINANCE");

  const [
    overview,
    recent,
    weekLedger,
    pendingPayments,
    claimedPayments,
    pendingCashSales,
    pendingCreditSales,
    pendingRepCollections,
    opFund,
    collections,
    cash,
  ] = await Promise.all([
    getFinanceOverview("month"),
    getLedger("month", 8),
    getLedger("week", 2000),
    prisma.request.count({
      where: { status: "APPROVED", paymentType: "IMMEDIATE", paymentStatus: "UNPAID" },
    }),
    prisma.request.count({
      where: {
        status: "APPROVED",
        paymentType: "IMMEDIATE",
        paymentStatus: "UNPAID",
        paymentClaimedAt: { not: null },
      },
    }),
    prisma.fieldSale.count({ where: { financeStatus: "PENDING", voided: false, type: "CASH" } }),
    prisma.fieldSale.count({ where: { financeStatus: "PENDING", voided: false, type: "CREDIT" } }),
    prisma.fieldPayment.count({
      where: { financeStatus: "PENDING", sale: { voided: false } },
    }),
    getOperationalFundBalance(),
    getCollectionsIntelligence(),
    getCashSummary(),
  ]);

  const fundBalance = opFund.balance;
  const cashAwaitingDeposit = cash.onHand.total;
  const p = overview.position;
  const w = overview.window;
  const todayCollections = overview.today.moneyIn - overview.today.capitalIn;

  // Weekly cash flow — bucket the ledger into the last 7 days.
  const days: { label: string; in: number; out: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push({ label: d.toLocaleDateString("en", { weekday: "short" }), in: 0, out: 0 });
  }
  for (const e of weekLedger) {
    const at = new Date(e.date);
    at.setHours(0, 0, 0, 0);
    const idx = days.findIndex((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return d.getTime() === at.getTime();
    });
    if (idx >= 0) {
      if (e.amount >= 0) days[idx].in += e.amount;
      else days[idx].out += -e.amount;
    }
  }
  const weekMax = Math.max(1, ...days.map((d) => Math.max(d.in, d.out)));

  // Greeting + date (Tanzania time, EAT)
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
  const firstName = me.name?.split(" ")[0] ?? "Finance";

  // Spending composition for the donut (this month, by group).
  const spendSegments = w.expenseBreakdown
    .map((g, i) => ({ label: g.label, value: g.amount, color: DONUT_COLORS[i % DONUT_COLORS.length] }))
    .filter((s) => s.value > 0);
  const spendTotal = spendSegments.reduce((s, x) => s + x.value, 0);

  return (
    <div className="space-y-6">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <DashboardHero
        eyebrow={dateLabel}
        pill="Finance"
        title={<>{greeting}, {firstName} 👋</>}
        subtitle="Manage payments, track collections, and keep ORA's financial records organized and up to date."
        stats={[
          { label: "Collections today", value: formatCurrency(todayCollections), sub: "customer money in" },
          { label: "Cash awaiting deposit", value: formatCurrency(cashAwaitingDeposit), sub: "in hand — bank it" },
          { label: "Operational Fund", value: formatCurrency(fundBalance), sub: "left to spend" },
          { label: "Outstanding debt", value: formatCurrency(p.creditOutstanding), sub: "still owed to ORA" },
        ]}
      />

      {/* ── Quick actions ────────────────────────────────────── */}
      <Reveal>
        <section>
          <SectionLabel>Quick actions</SectionLabel>
          <div className="flex flex-wrap gap-2">
            <QuickAction icon={ClipboardCheck} label="Confirm payment" href="/finance/payments" />
            <QuickAction icon={BadgeCheck} label="Review credit sales" href="/finance/sales-approvals" />
            <QuickAction icon={Landmark} label="Record deposit" href="/finance/cash" />
            <QuickAction icon={Receipt} label="Operational expense" href="/finance/operational-fund" />
            <QuickAction icon={UserCheck} label="Review application" href="/finance/applications" />
            <QuickAction icon={Users} label="View customers" href="/finance/customers" />
          </div>
        </section>
      </Reveal>

      {/* ── Needs your attention ─────────────────────────────── */}
      <section>
        <SectionLabel>Needs your attention</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AttnCard href="/finance/sales-approvals" icon={Banknote} label="Cash to confirm" value={formatNumber(pendingCashSales)} hint="rep cash sales to receive & bank" active={pendingCashSales > 0} />
          <AttnCard href="/finance/sales-approvals" icon={CreditCard} label="Credit to approve" value={formatNumber(pendingCreditSales)} hint="rep credit sales to review" active={pendingCreditSales > 0} />
          <AttnCard href="/finance/payments" icon={ClipboardCheck} label="Customer payments" value={formatNumber(pendingPayments)} hint={claimedPayments > 0 ? `${claimedPayments} claimed — verify receipt` : "direct payments to verify"} active={pendingPayments > 0} />
          <AttnCard href="/finance/sales-approvals" icon={Landmark} label="Deposits to post" value={formatNumber(pendingRepCollections)} hint="rep-collected repayments" active={pendingRepCollections > 0} />
        </div>
      </section>

      {/* ── This month ───────────────────────────────────────── */}
      <section>
        <SectionLabel>This month</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Revenue" value={formatCurrency(w.revenue)} hint={`collected ${formatCurrency(w.income.total - w.income.capital)}`} icon={TrendingUp} accent="primary" />
          <StatCard label="Expenses" value={formatCurrency(w.expenses)} hint={`net ${w.netProfit >= 0 ? "+" : ""}${formatCurrency(w.netProfit)}`} icon={TrendingDown} accent={w.netProfit >= 0 ? "success" : "warning"} />
          <StatCard label="Today's collections" value={formatCurrency(todayCollections)} hint="customer money in today" icon={ArrowDownToLine} accent="success" />
          <StatCard label="Today's payments" value={formatCurrency(overview.today.moneyOut)} hint="money out today" icon={ArrowUpFromLine} accent="warning" />
        </div>
      </section>

      {/* ── Collections & follow-up (due, overdue, performance) ── */}
      <CollectionsAndCredit ci={collections} creditHref="/finance/credit" />

      {/* ── Cash flow + spending composition ─────────────────── */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" /> Cash flow · last 7 days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 items-end gap-2 sm:gap-3" style={{ height: 160 }}>
              {days.map((d, i) => (
                <div key={i} className="flex h-full flex-col items-center justify-end gap-1">
                  <div className="flex w-full flex-1 items-end justify-center gap-1">
                    <div className="w-1/2 rounded-t-md bg-success/80" style={{ height: `${Math.max((d.in / weekMax) * 100, d.in > 0 ? 4 : 0)}%` }} title={`In ${formatCurrency(d.in)}`} />
                    <div className="w-1/2 rounded-t-md bg-destructive/70" style={{ height: `${Math.max((d.out / weekMax) * 100, d.out > 0 ? 4 : 0)}%` }} title={`Out ${formatCurrency(d.out)}`} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{d.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-success/80" /> Money in</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-destructive/70" /> Money out</span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="flex items-center gap-2"><PieChart className="size-4 text-primary" /> Where money went · this month</span>
              {spendSegments.length > 0 && <span className="text-[10px] font-normal uppercase tracking-wide text-muted-foreground">TSh &rsquo;000</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {spendSegments.length === 0 ? (
              <EmptyState icon={PieChart} title="No spending yet" description="Recorded expenses appear here, grouped by type." />
            ) : (
              <DonutChart
                segments={spendSegments.map((s) => ({ ...s, value: Math.round(s.value / 1000) }))}
                centerLabel="spent"
                centervalue={<span className="text-lg">{formatCurrency(spendTotal)}</span>}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Receivables + recent activity ────────────────────── */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-4 text-primary" /> Accounts receivable
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl bg-muted/50 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Outstanding customer credit</p>
              <p className="mt-1 font-display text-3xl font-bold">{formatCurrency(p.creditOutstanding)}</p>
              {p.overdueCount > 0 && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-warning">
                  <AlertTriangle className="size-3.5" />
                  {p.overdueCount} overdue account{p.overdueCount === 1 ? "" : "s"} need chasing
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Partners</p>
                <p className="font-semibold">{formatCurrency(p.creditOutstandingPartner)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Field customers</p>
                <p className="font-semibold">{formatCurrency(p.creditOutstandingField)}</p>
              </div>
            </div>
            <Link href="/finance/credit" className="flex items-center justify-between rounded-lg border border-border/60 p-3 text-sm font-medium transition hover:bg-muted/40">
              Manage credit &amp; settlements
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="size-4 text-primary" /> Recent financial activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <EmptyState icon={Receipt} title="No activity yet" description="Money movements appear here as they happen." />
            ) : (
              <ul className="divide-y divide-border/60">
                {recent.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium">{e.label}</span>{" "}
                      <span className="text-muted-foreground">· {e.reference}{e.method ? ` · ${e.method}` : ""}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge variant="secondary">{e.category}</Badge>
                      <span className={cn("font-semibold", e.amount >= 0 ? "text-success" : "text-destructive")}>
                        {e.amount >= 0 ? "+" : "−"}{formatCurrency(Math.abs(e.amount))}
                      </span>
                      <span className="text-xs text-muted-foreground">{timeAgo(e.date)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Local premium bits (styling mirrors the Admin dashboard) ─────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>;
}

function QuickAction({ icon: Icon, label, href }: { icon: LucideIcon; label: string; href: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-medium shadow-soft transition-colors hover:border-primary/40 hover:bg-muted/40">
      <Icon className="size-4 text-primary" />
      {label}
    </Link>
  );
}

function AttnCard({
  href,
  icon: Icon,
  label,
  value,
  hint,
  active,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group rounded-2xl border p-4 shadow-soft transition-all hover:-translate-y-0.5",
        active ? "border-warning/30 bg-warning/[0.05] hover:border-warning/50" : "border-border bg-card hover:border-primary/30",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", active ? "bg-warning/15 text-warning" : "bg-success/12 text-success")}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 font-display text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
    </Link>
  );
}
