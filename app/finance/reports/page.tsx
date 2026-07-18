import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  Banknote,
  Receipt,
  Users,
  Landmark,
  Scale,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { getFinanceOverview } from "@/lib/services/finance";
import { getOperationalFundBalance } from "@/lib/services/operational-fund";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BarChart } from "@/components/ui/charts";
import { Progress } from "@/components/ui/progress";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FinanceReportsPage() {
  await requireRole("FINANCE");

  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const [d, opFund, taxesThisYear] = await Promise.all([
    getFinanceOverview("month"),
    // Operational Fund balance (CEO-approved allocation not yet spent).
    getOperationalFundBalance(),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { category: "TAXES", expenseDate: { gte: yearStart } },
    }),
  ]);

  const w = d.window;
  const p = d.position;

  const pettyCashOpen = opFund.balance;
  const taxesPaid = taxesThisYear._sum.amount ?? 0;

  // Payroll is paid the moment the boss runs it (booked straight to expenses),
  // so there is never an outstanding salary liability. The Operational Fund
  // balance is cash finance still holds (an asset/float), not money owed.
  const payables = 0;
  const receivables = p.creditOutstanding;
  const assets = p.cashAvailable + receivables + p.stockValue;
  const equity = assets - payables;

  const inBars = d.months.map((m) => ({
    label: m.label,
    value: Math.round(m.income / 1000),
    color: "hsl(145 65% 52%)",
  }));
  const outBars = d.months.map((m) => ({
    label: m.label,
    value: Math.round(m.expenses / 1000),
    color: "hsl(0 75% 60%)",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial reports"
        description="Profit & loss, cash flow, receivables, payables and the balance snapshot — built live from the ledger."
      />

      {/* Headline figures — this month */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Income this month"
          value={formatCurrency(w.income.income)}
          icon={TrendingUp}
          accent="success"
          hint={`cash sales ${formatCurrency(w.income.sales)} · repayments ${formatCurrency(w.income.collections)}`}
        />
        <StatCard
          label="Expenses this month"
          value={formatCurrency(w.expenses)}
          icon={TrendingDown}
          accent="warning"
        />
        <StatCard
          label="Net profit this month"
          value={formatCurrency(w.netProfit)}
          icon={Wallet}
          accent={w.netProfit >= 0 ? "primary" : "warning"}
          hint={`gross ${formatCurrency(w.grossProfit)} − operating costs`}
        />
      </div>

      {/* P&L + Cash flow */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profit &amp; Loss (this month)</CardTitle>
            <CardDescription>
              Accrual view — revenue when sold, stock cost through COGS.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 rounded-xl border border-border/60 p-4 text-sm">
              <Row
                label={`Revenue (${formatNumber(w.unitsSold)} units sold)`}
                value={formatCurrency(w.revenue)}
              />
              <Row label="− Cost of goods sold" value={formatCurrency(w.cogs)} muted />
              <Row label="= Gross profit" value={formatCurrency(w.grossProfit)} strong />
              <Row
                label="− Operating expenses"
                value={formatCurrency(w.operatingExpenses)}
                muted
              />
              <Row
                label="= Net profit"
                value={formatCurrency(w.netProfit)}
                strong
                tone={w.netProfit >= 0 ? "text-success" : "text-destructive"}
              />
            </div>

            <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Expenses by group
            </h3>
            <div className="mt-2 space-y-2.5">
              {w.expenseBreakdown.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No expenses recorded this month.
                </p>
              ) : (
                w.expenseBreakdown.map((g) => {
                  const pct =
                    w.expenses > 0 ? Math.round((g.amount / w.expenses) * 100) : 0;
                  return (
                    <div key={g.label}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{g.label}</span>
                        <span className="font-semibold">
                          {formatCurrency(g.amount)}{" "}
                          <span className="text-xs text-muted-foreground">({pct}%)</span>
                        </span>
                      </div>
                      <Progress value={pct} className="mt-1" />
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cash flow</CardTitle>
            <CardDescription>
              Actual money movement — today and the last six months.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-success/10 p-3.5">
                <p className="text-xs font-medium uppercase tracking-wide text-success">
                  In today
                </p>
                <p className="mt-1 font-display text-xl font-bold">
                  {formatCurrency(d.today.moneyIn)}
                </p>
              </div>
              <div className="rounded-xl bg-destructive/10 p-3.5">
                <p className="text-xs font-medium uppercase tracking-wide text-destructive">
                  Out today
                </p>
                <p className="mt-1 font-display text-xl font-bold">
                  {formatCurrency(d.today.moneyOut)}
                </p>
              </div>
              <div className="rounded-xl bg-primary/10 p-3.5">
                <p className="text-xs font-medium uppercase tracking-wide text-primary">
                  Net today
                </p>
                <p
                  className={cn(
                    "mt-1 font-display text-xl font-bold",
                    d.today.net < 0 && "text-destructive",
                  )}
                >
                  {formatCurrency(d.today.net)}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Money in
                  </h3>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    TSh ’000
                  </span>
                </div>
                <BarChart data={inBars} height={120} showValues={false} className="mt-2" />
              </div>
              <div>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Money out
                  </h3>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    TSh ’000
                  </span>
                </div>
                <BarChart data={outBars} height={120} showValues={false} className="mt-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Receivables + Payables */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Receivables (AR)</CardTitle>
            <CardDescription>Money owed to ORA — expected income, not cash yet.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                <span className="flex items-center gap-2.5 text-sm font-medium">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-warning/15 text-warning">
                    <CreditCard className="size-4" />
                  </span>
                  Partner credit outstanding
                </span>
                <span className="font-semibold">
                  {formatCurrency(p.creditOutstandingPartner)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                <span className="flex items-center gap-2.5 text-sm font-medium">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-info/12 text-info">
                    <Users className="size-4" />
                  </span>
                  Field (rep customer) credit
                </span>
                <span className="font-semibold">
                  {formatCurrency(p.creditOutstandingField)}
                </span>
              </div>
            </div>
            <div className="mt-3 space-y-1.5 rounded-xl border border-border/60 p-4 text-sm">
              <Row label="Total receivable" value={formatCurrency(receivables)} strong />
              <Row
                label="Overdue accounts"
                value={`${formatNumber(p.overdueCount)}`}
                tone={p.overdueCount > 0 ? "text-destructive" : "text-success"}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payables (AP)</CardTitle>
            <CardDescription>Money ORA has committed but not yet paid out.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                <span className="flex items-center gap-2.5 text-sm font-medium">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-success/15 text-success">
                    <Users className="size-4" />
                  </span>
                  <span>
                    Payroll
                    <span className="block text-xs font-normal text-muted-foreground">
                      paid in full the moment the boss runs it — no salary ever left owing
                    </span>
                  </span>
                </span>
                <span className="font-semibold">{formatCurrency(0)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                <span className="flex items-center gap-2.5 text-sm font-medium">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Banknote className="size-4" />
                  </span>
                  <span>
                    Operational Fund balance (informational)
                    <span className="block text-xs font-normal text-muted-foreground">
                      allocated cash finance still holds to spend — already expensed at approval
                    </span>
                  </span>
                </span>
                <span className="font-semibold text-muted-foreground">{formatCurrency(pettyCashOpen)}</span>
              </div>
            </div>
            <div className="mt-3 space-y-1.5 rounded-xl border border-border/60 p-4 text-sm">
              <Row label="Total payable" value={formatCurrency(payables)} strong />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Balance snapshot + Tax */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Balance snapshot</CardTitle>
            <CardDescription>
              What ORA owns vs what it owes, as of right now.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 p-4">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Landmark className="size-3.5" /> Assets
                </h3>
                <div className="mt-2 space-y-1.5 text-sm">
                  <Row label="Cash available" value={formatCurrency(p.cashAvailable)} />
                  <Row label="Receivables (AR)" value={formatCurrency(receivables)} />
                  <Row label="Stock value (cost)" value={formatCurrency(p.stockValue)} />
                  <Row label="Total assets" value={formatCurrency(assets)} strong />
                </div>
              </div>
              <div className="rounded-xl border border-border/60 p-4">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Scale className="size-3.5" /> Liabilities
                </h3>
                <div className="mt-2 space-y-1.5 text-sm">
                  <Row label="Payroll (paid on run)" value={formatCurrency(0)} />
                  <Row label="Total liabilities" value={formatCurrency(payables)} strong />
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-primary/10 p-4">
              <span className="text-sm font-medium">Equity (assets − liabilities)</span>
              <span
                className={cn(
                  "font-display text-xl font-bold",
                  equity < 0 && "text-destructive",
                )}
              >
                {formatCurrency(equity)}
              </span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Assets include stock anywhere in the system at cost.{" "}
              {formatCurrency(p.capitalTotal)} of net capital remains (invested − withdrawn).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tax</CardTitle>
            <CardDescription>Statutory payments recorded this year.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-4">
              <span className="flex items-center gap-2.5 text-sm font-medium">
                <span className="flex size-8 items-center justify-center rounded-lg bg-accent/12 text-accent">
                  <Receipt className="size-4" />
                </span>
                Taxes paid this year
              </span>
              <span className="font-display text-xl font-bold">
                {formatCurrency(taxesPaid)}
              </span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Tax filings are prepared from the expense ledger — every payment
              recorded under the Taxes category feeds this figure automatically.
            </p>
          </CardContent>
        </Card>
      </div>
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
