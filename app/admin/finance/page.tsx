import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  Package,
  HeartHandshake,
  Banknote,
  ArrowRight,
  ShieldCheck,
  PiggyBank,
} from "lucide-react";
import { requireRole } from "@/lib/rbac";
import {
  getFinanceOverview,
  getLedger,
  type Period,
} from "@/lib/services/finance";
import { PageHeader } from "@/components/ui/page-header";
import { FinanceNav, PeriodTabs } from "@/components/admin/finance-nav";
import { StatCard } from "@/components/ui/stat-card";
import { Progress } from "@/components/ui/progress";
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

  const [d, recent] = await Promise.all([
    getFinanceOverview(period),
    getLedger("all", 8),
  ]);
  const w = d.window;
  const p = d.position;

  const health =
    d.healthScore >= 75
      ? { label: "Healthy", tone: "text-success", bar: "bg-success" }
      : d.healthScore >= 45
        ? { label: "Stable", tone: "text-warning", bar: "bg-warning" }
        : { label: "Needs attention", tone: "text-destructive", bar: "bg-destructive" };

  const incomeSources = [
    { label: "Sales income", value: w.income.sales, icon: Banknote },
    { label: "Credit collected", value: w.income.collections, icon: CreditCard },
    { label: "Donations", value: w.income.donations, icon: HeartHandshake },
    { label: "Capital injected", value: w.income.capital, icon: PiggyBank },
  ].filter((s) => s.value > 0);

  const maxTrend = Math.max(1, ...d.months.map((m) => Math.max(m.income, m.expenses)));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        description="Where ORA money comes from and where it goes — live, categorised, traceable."
      >
        <FinanceNav />
      </PageHeader>

      <PeriodTabs period={period} basePath="/admin/finance" />

      {/* Overview cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label={`Income ${PERIOD_LABEL[period]}`} value={formatCurrency(w.income.income)} icon={TrendingUp} accent="success" hint={`+ ${formatCurrency(w.income.capital)} capital`} />
        <StatCard label={`Expenses ${PERIOD_LABEL[period]}`} value={formatCurrency(w.expenses)} icon={TrendingDown} accent="warning" />
        <StatCard
          label={`Net profit ${PERIOD_LABEL[period]}`}
          value={formatCurrency(w.netProfit)}
          icon={Wallet}
          accent={w.netProfit >= 0 ? "primary" : "warning"}
          hint={`gross ${formatCurrency(w.grossProfit)} − operating costs`}
        />
        <StatCard label="Cash available" value={formatCurrency(p.cashAvailable)} icon={Banknote} accent="success" hint="all money in − all money out" />
        <StatCard label="Credit outstanding" value={formatCurrency(p.creditOutstanding)} icon={CreditCard} accent="warning" hint={p.overdueCount > 0 ? `${p.overdueCount} overdue — expected income, not cash` : "expected income, not cash yet"} />
        <StatCard label="Stock value (cost)" value={formatCurrency(p.stockValue)} icon={Package} accent="info" hint={`worth ${formatCurrency(p.stockPotentialRevenue)} if all sold`} />
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
            <Row label="Cash available" value={formatCurrency(p.cashAvailable)} />
            <Row label="Tied up in credit" value={formatCurrency(p.creditOutstanding)} muted />
            <Row label="Tied up in stock" value={formatCurrency(p.stockValue)} muted />
            <Row label="Capital injected (all time)" value={formatCurrency(p.capitalTotal)} muted />
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
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Top expenses <span className="text-sm font-normal text-muted-foreground">· {PERIOD_LABEL[period]}</span></h2>
            <Link href="/admin/finance/expenses" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Manage <ArrowRight className="size-4" />
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
