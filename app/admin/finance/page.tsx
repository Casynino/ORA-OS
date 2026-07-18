import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  Banknote,
  ArrowRight,
  ShieldCheck,
  PiggyBank,
  Boxes,
  Layers,
  AlertTriangle,
} from "lucide-react";
import { requireRole } from "@/lib/rbac";
import {
  getFinanceOverview,
  getLedger,
  type Period,
} from "@/lib/services/finance";
import { getCashSummary } from "@/lib/services/cash";
import { getSelectableAccounts } from "@/lib/services/accounts";
import { getSelectableCategories } from "@/lib/services/categories";
import { PageHeader } from "@/components/ui/page-header";
import { FinanceNav, PeriodTabs } from "@/components/admin/finance-nav";
import { StatCard } from "@/components/ui/stat-card";
import { Progress } from "@/components/ui/progress";
import {
  AddExpenseButton,
  AddCapitalButton,
  RecordWithdrawalButton,
  IssueFundsButton,
} from "@/components/admin/finance-forms";
import { cn, formatCurrency, formatNumber, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PERIOD_LABEL: Record<Period, string> = {
  today: "today",
  week: "this week",
  month: "this month",
  all: "all time",
};

export default async function AdminFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireRole("ADMIN");
  const { period: raw = "month" } = await searchParams;
  const period = (["today", "week", "month", "all"].includes(raw) ? raw : "month") as Period;

  const [d, recent, cash, accounts, categories] = await Promise.all([
    getFinanceOverview(period),
    getLedger("all", 8),
    getCashSummary(),
    getSelectableAccounts(),
    getSelectableCategories(),
  ]);
  const w = d.window;
  const p = d.position;
  const cashOnHand = cash.onHand.total;

  // Business Capital = the money available to run ORA (all money in − all out).
  const businessCapital = p.businessCapital;
  const atLoss = w.netProfit < 0; // this period spent more than it earned
  const capitalDepleted = businessCapital <= 0;

  const health =
    d.healthScore >= 75
      ? { label: "Healthy", tone: "text-success", bar: "bg-success" }
      : d.healthScore >= 45
        ? { label: "Stable", tone: "text-warning", bar: "bg-warning" }
        : { label: "Needs attention", tone: "text-destructive", bar: "bg-destructive" };

  const incomeSources = [
    { label: "Cash sales", value: w.income.sales, icon: Banknote },
    { label: "Credit repayments received", value: w.income.collections, icon: CreditCard },
    { label: "Capital injected", value: w.income.capital, icon: PiggyBank },
  ].filter((s) => s.value > 0);

  const maxTrend = Math.max(1, ...d.months.map((m) => Math.max(m.income, m.expenses)));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        description="Where ORA money comes from and where it goes — live, categorised, traceable."
      />
      <FinanceNav />

      <PeriodTabs period={period} basePath="/admin/finance" />

      {/* Business Capital hero — the money available to run ORA */}
      <section
        className={cn(
          "rounded-2xl border p-5 shadow-soft",
          capitalDepleted ? "border-destructive/40 bg-destructive/[0.04]" : "border-primary/30 bg-primary/[0.04]",
        )}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Wallet className="size-4 text-primary" /> Business Capital
            </p>
            <p className={cn("mt-1 font-display text-4xl font-extrabold tracking-tight", capitalDepleted && "text-destructive")}>
              {formatCurrency(businessCapital)}
            </p>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              The money available to run ORA — all money in − all money out, calculated live so it never drifts.
            </p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              {/* Show withdrawals as money OUT (add them back to both sides — the
                  difference is unchanged, so in − out still equals capital). */}
              <span>Money in (all time): <b className="text-foreground">{formatCurrency(p.allTimeIn + p.capitalWithdrawn)}</b></span>
              <span>Money out (all time): <b className="text-foreground">{formatCurrency(p.allTimeOut + p.capitalWithdrawn)}</b></span>
              <span>Invested: <b className="text-success">{formatCurrency(p.capitalInjected)}</b></span>
              {p.capitalWithdrawn > 0 && (
                <span>Withdrawn: <b className="text-destructive">{formatCurrency(p.capitalWithdrawn)}</b></span>
              )}
            </div>
          </div>
          {/* CEO money actions — one tidy stack, always here on the overview.
              Full-width so long labels never overflow the banner; varied
              variants (issue = primary, invest = green, the rest outline) give
              it rhythm instead of four identical pills. */}
          <div className="flex w-full shrink-0 flex-col items-stretch gap-2 lg:w-60">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Quick actions</p>
            <IssueFundsButton accounts={accounts} variant="default" className="w-full justify-center rounded-full" />
            <AddExpenseButton accounts={accounts} categories={categories} variant="outline" className="w-full justify-center rounded-full" />
            <AddCapitalButton accounts={accounts} variant="success" className="w-full justify-center rounded-full" />
            <RecordWithdrawalButton accounts={accounts} variant="outline" className="w-full justify-center rounded-full" />
          </div>
        </div>
        {capitalDepleted && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            <AlertTriangle className="size-4 shrink-0" /> Business Capital is depleted — spending has caught up with income. Add capital or slow spending.
          </p>
        )}
      </section>

      {/* Loss signal */}
      {atLoss && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-warning/40 bg-warning/[0.06] p-4 text-sm">
          <AlertTriangle className="size-5 shrink-0 text-warning" />
          <span className="font-semibold">Operating at a loss {PERIOD_LABEL[period]}</span>
          <span className="text-muted-foreground">
            — revenue {formatCurrency(w.revenue)} vs expenses {formatCurrency(w.expenses)} → net {formatCurrency(w.netProfit)}.
          </span>
        </div>
      )}

      {/* Financial health cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Cash on hand" value={formatCurrency(cashOnHand)} icon={Banknote} accent="success" hint="received, not yet banked" />
        <StatCard label={`Revenue ${PERIOD_LABEL[period]}`} value={formatCurrency(w.revenue)} icon={TrendingUp} accent="success" hint={`${formatNumber(w.unitsSold)} packs sold`} />
        <StatCard label={`Total expenses ${PERIOD_LABEL[period]}`} value={formatCurrency(w.expenses)} icon={TrendingDown} accent="warning" />
        <StatCard label={`Gross profit ${PERIOD_LABEL[period]}`} value={formatCurrency(w.grossProfit)} icon={Layers} accent="info" hint="revenue − cost of goods" />
        <StatCard label={`Net profit ${PERIOD_LABEL[period]}`} value={formatCurrency(w.netProfit)} icon={Wallet} accent={w.netProfit >= 0 ? "primary" : "warning"} hint={atLoss ? "operating at a loss" : "after all costs"} />
        <StatCard label="Inventory value (cost)" value={formatCurrency(p.stockValue)} icon={Boxes} accent="info" hint={`worth ${formatCurrency(p.stockPotentialRevenue)} sold`} />
        <StatCard label="Outstanding customer debt" value={formatCurrency(p.creditOutstanding)} icon={CreditCard} accent="warning" hint={p.overdueCount > 0 ? `${p.overdueCount} overdue` : "expected income, not cash"} />
        <StatCard label="Capital injected" value={formatCurrency(p.capitalInjected)} icon={PiggyBank} accent="info" hint={p.capitalWithdrawn > 0 ? `${formatCurrency(p.capitalWithdrawn)} withdrawn` : "owner + investors"} />
      </div>

      {/* Today's cash movement + health */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="font-display text-lg font-semibold">Cash flow today</h2>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-success/10 p-3.5">
              <p className="text-xs font-medium uppercase tracking-wide text-success">Money in</p>
              <p className="mt-1 font-display text-xl font-bold">{formatCurrency(d.today.moneyIn)}</p>
            </div>
            <div className="rounded-xl bg-destructive/10 p-3.5">
              <p className="text-xs font-medium uppercase tracking-wide text-destructive">Money out</p>
              <p className="mt-1 font-display text-xl font-bold">{formatCurrency(d.today.moneyOut)}</p>
            </div>
            <div className="rounded-xl bg-primary/10 p-3.5">
              <p className="text-xs font-medium uppercase tracking-wide text-primary">Net</p>
              <p className={cn("mt-1 font-display text-xl font-bold", d.today.net < 0 && "text-destructive")}>
                {formatCurrency(d.today.net)}
              </p>
            </div>
          </div>

          {/* Profit maths */}
          <div className="mt-5 space-y-1.5 rounded-xl border border-border/60 p-4 text-sm">
            <Row label={`Revenue (${formatNumber(w.unitsSold)} units sold)`} value={formatCurrency(w.revenue)} />
            <Row label="− Cost of goods sold" value={formatCurrency(w.cogs)} muted />
            <Row label="= Gross profit" value={formatCurrency(w.grossProfit)} strong />
            <Row label="− Operating expenses" value={formatCurrency(w.operatingExpenses)} muted />
            <Row
              label="= Net profit"
              value={formatCurrency(w.netProfit)}
              strong
              tone={w.netProfit >= 0 ? "text-success" : "text-destructive"}
            />
            <p className="pt-1 text-xs text-muted-foreground">
              Stock purchases are not double-counted — they reach profit through cost of goods sold.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Financial health</h2>
            <ShieldCheck className={cn("size-5", health.tone)} />
          </div>
          <div className="mt-4 flex items-end gap-3">
            <span className="font-display text-5xl font-extrabold tracking-tight">{d.healthScore}</span>
            <span className={cn("pb-1.5 text-sm font-semibold", health.tone)}>/100 · {health.label}</span>
          </div>
          <Progress value={d.healthScore} className="mt-3" indicatorClassName={health.bar} />
          <p className="mt-3 text-xs text-muted-foreground">
            Blend of profit margin, cash cover vs monthly costs, credit exposure and overdue debts.
          </p>

          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Real cash position
          </h3>
          <div className="mt-2 space-y-1.5 text-sm">
            <Row label="Business Capital (cash)" value={formatCurrency(p.businessCapital)} />
            <Row label="Tied up in credit" value={formatCurrency(p.creditOutstanding)} muted />
            <Row label="Tied up in stock" value={formatCurrency(p.stockValue)} muted />
            <Row label="Net capital (invested − withdrawn)" value={formatCurrency(p.capitalTotal)} muted />
          </div>
        </section>
      </div>

      {/* Income sources + expense breakdown */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="font-display text-lg font-semibold">Income sources <span className="text-sm font-normal text-muted-foreground">· {PERIOD_LABEL[period]}</span></h2>
          <div className="mt-3 space-y-2">
            {incomeSources.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                No income recorded {PERIOD_LABEL[period]}.
              </p>
            ) : (
              incomeSources.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                  <span className="flex items-center gap-2.5 text-sm font-medium">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-success/10 text-success">
                      <s.icon className="size-4" />
                    </span>
                    {s.label}
                  </span>
                  <span className="font-semibold">{formatCurrency(s.value)}</span>
                </div>
              ))
            )}
            {w.creditSales > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-warning/40 bg-warning/[0.04] p-3">
                <span className="flex items-center gap-2.5 text-sm font-medium">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-warning/15 text-warning">
                    <CreditCard className="size-4" />
                  </span>
                  <span>
                    Credit sales
                    <span className="block text-xs font-normal text-muted-foreground">
                      receivable — becomes income when repaid
                    </span>
                  </span>
                </span>
                <span className="font-semibold text-warning">{formatCurrency(w.creditSales)}</span>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Top expenses <span className="text-sm font-normal text-muted-foreground">· {PERIOD_LABEL[period]}</span></h2>
            <Link href="/admin/finance/ledger" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              View all <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mt-3 space-y-2.5">
            {w.topCategories.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                No expenses recorded {PERIOD_LABEL[period]} — record them so profit is real.
              </p>
            ) : (
              w.topCategories.map((c) => {
                const pct = w.expenses > 0 ? Math.round((c.amount / w.expenses) * 100) : 0;
                return (
                  <div key={c.category}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{c.label}</span>
                      <span className="font-semibold">{formatCurrency(c.amount)} <span className="text-xs text-muted-foreground">({pct}%)</span></span>
                    </div>
                    <Progress value={pct} className="mt-1" />
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* 6-month trend */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="font-display text-lg font-semibold">Income vs expenses — last 6 months</h2>
        <div className="mt-5 grid grid-cols-6 items-end gap-2 sm:gap-4" style={{ height: 160 }}>
          {d.months.map((m) => (
            <div key={m.label} className="flex h-full flex-col items-center justify-end gap-1">
              <div className="flex w-full flex-1 items-end justify-center gap-1">
                <div
                  className="w-1/3 rounded-t-md bg-success/80"
                  style={{ height: `${Math.max((m.income / maxTrend) * 100, m.income > 0 ? 3 : 0)}%` }}
                  title={`In ${formatCurrency(m.income)}`}
                />
                <div
                  className="w-1/3 rounded-t-md bg-destructive/70"
                  style={{ height: `${Math.max((m.expenses / maxTrend) * 100, m.expenses > 0 ? 3 : 0)}%` }}
                  title={`Out ${formatCurrency(m.expenses)}`}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{m.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-success/80" /> Money in</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-destructive/70" /> Money out</span>
        </div>
      </section>

      {/* Recent transactions */}
      <section className="rounded-2xl border border-border bg-card shadow-soft">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Latest transactions</h2>
          <Link href="/admin/finance/ledger" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Full ledger <ArrowRight className="size-4" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <div>
            {recent.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-5 py-3 last:border-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{e.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.reference} · {e.category} · {timeAgo(e.date)}
                  </p>
                </div>
                <span className={cn("shrink-0 text-sm font-semibold", e.amount >= 0 ? "text-success" : "text-destructive")}>
                  {e.amount >= 0 ? "+" : "−"}{formatCurrency(Math.abs(e.amount))}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  strong,
  tone,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn("min-w-0 truncate", muted ? "text-muted-foreground" : "")}>{label}</span>
      <span className={cn("shrink-0", strong ? "font-bold" : "font-medium", tone)}>{value}</span>
    </div>
  );
}
