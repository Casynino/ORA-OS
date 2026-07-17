import Link from "next/link";
import {
  Banknote,
  Landmark,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  CreditCard,
  Receipt,
  TrendingUp,
  TrendingDown,
  ClipboardCheck,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getFinanceOverview, getLedger } from "@/lib/services/finance";
import { getOperationalFundBalance } from "@/lib/services/operational-fund";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { BarChart } from "@/components/ui/charts";
import { formatCurrency, formatNumber, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** The Finance & Accounting dashboard — financial, not operational. */
export default async function FinanceDashboardPage() {
  const me = await requireRole("FINANCE");

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  weekAgo.setHours(0, 0, 0, 0);

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
  ]);

  // Operational Fund balance = CEO-approved funding − operational spend. One
  // shared pool the CEO tops up and finance spends down, accounting for every
  // shilling.
  const fundBalance = opFund.balance;

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
    const idx = days.findIndex(
      (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        d.setHours(0, 0, 0, 0);
        return d.getTime() === at.getTime();
      },
    );
    if (idx >= 0) {
      if (e.amount >= 0) days[idx].in += e.amount;
      else days[idx].out += -e.amount;
    }
  }

  const todayCollections = overview.today.moneyIn - overview.today.capitalIn;

  return (
    <div className="space-y-7">
      <PageHeader
        title={`Karibu, ${me.name?.split(" ")[0] ?? "Finance"}`}
        description="You collect, verify, deposit and follow up ORA's money — the CEO owns the accounts. Here's what needs you today."
      />

      {/* ── Needs your attention — the finance operations queue ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Needs your attention</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Link href="/finance/sales-approvals" className="transition-transform hover:-translate-y-0.5">
            <StatCard
              label="Pending cash confirmations"
              value={formatNumber(pendingCashSales)}
              hint="rep cash sales to receive & bank"
              icon={Banknote}
              accent={pendingCashSales > 0 ? "warning" : "success"}
            />
          </Link>
          <Link href="/finance/sales-approvals" className="transition-transform hover:-translate-y-0.5">
            <StatCard
              label="Pending credit confirmations"
              value={formatNumber(pendingCreditSales)}
              hint="rep credit sales to approve"
              icon={CreditCard}
              accent={pendingCreditSales > 0 ? "warning" : "success"}
            />
          </Link>
          <Link href="/finance/payments" className="transition-transform hover:-translate-y-0.5">
            <StatCard
              label="Pending customer payments"
              value={formatNumber(pendingPayments)}
              hint={claimedPayments > 0 ? `${claimedPayments} claimed — verify the receipt` : "direct payments to verify"}
              icon={ClipboardCheck}
              accent={pendingPayments > 0 ? "warning" : "success"}
            />
          </Link>
          <Link href="/finance/sales-approvals" className="transition-transform hover:-translate-y-0.5">
            <StatCard
              label="Deposits waiting to be verified"
              value={formatNumber(pendingRepCollections)}
              hint="rep-collected repayments to post"
              icon={Landmark}
              accent={pendingRepCollections > 0 ? "warning" : "success"}
            />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Link href="/finance/credit" className="transition-transform hover:-translate-y-0.5">
            <StatCard
              label="Outstanding debts"
              value={formatCurrency(overview.position.creditOutstanding)}
              hint="customer credit still owed"
              icon={CreditCard}
              accent={overview.position.creditOutstanding > 0 ? "info" : "success"}
            />
          </Link>
          <Link href="/finance/credit" className="transition-transform hover:-translate-y-0.5">
            <StatCard
              label="Overdue customers"
              value={formatNumber(overview.position.overdueCount)}
              hint="past due — chase for settlement"
              icon={AlertTriangle}
              accent={overview.position.overdueCount > 0 ? "warning" : "success"}
            />
          </Link>
          <StatCard
            label="Today's collections"
            value={formatCurrency(todayCollections)}
            hint="customer money in today"
            icon={ArrowDownToLine}
            accent="success"
          />
          <Link href="/finance/operational-fund" className="transition-transform hover:-translate-y-0.5">
            <StatCard
              label="Operational Fund"
              value={formatCurrency(fundBalance)}
              hint="available balance to spend"
              icon={Wallet}
              accent={fundBalance > 0 ? "primary" : "info"}
            />
          </Link>
        </div>
      </section>

      {/* This month */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Today's payments" value={formatCurrency(overview.today.moneyOut)} hint="money out today" icon={ArrowUpFromLine} accent="warning" />
        <StatCard label="Revenue this month" value={formatCurrency(overview.window.revenue)} hint={`collected ${formatCurrency(overview.window.income.total - overview.window.income.capital)}`} icon={TrendingUp} accent="primary" />
        <StatCard
          label="Expenses this month"
          value={formatCurrency(overview.window.expenses)}
          hint={`net ${overview.window.netProfit >= 0 ? "+" : ""}${formatCurrency(overview.window.netProfit)}`}
          icon={TrendingDown}
          accent={overview.window.netProfit >= 0 ? "success" : "warning"}
        />
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* Weekly cash flow */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Weekly cash flow</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={days.map((d) => ({ label: d.label, value: d.in }))}
            />
            <div className="mt-3 grid grid-cols-7 gap-1 text-center">
              {days.map((d, i) => (
                <div key={i} className="min-w-0">
                  <p className="truncate text-[10px] text-muted-foreground">{d.label}</p>
                  <p className="truncate text-[11px] font-medium text-success">+{formatNumber(d.in)}</p>
                  <p className="truncate text-[11px] text-muted-foreground">−{formatNumber(d.out)}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Money in per day · last 7 days — figures under each bar show in / out.
            </p>
          </CardContent>
        </Card>

        {/* Receivables */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-4" /> Accounts receivable
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl bg-muted/50 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Outstanding customer credit</p>
              <p className="mt-1 font-display text-3xl font-bold">{formatCurrency(overview.position.creditOutstanding)}</p>
              {overview.position.overdueCount > 0 && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-warning">
                  <AlertTriangle className="size-3.5" />
                  {overview.position.overdueCount} overdue account{overview.position.overdueCount === 1 ? "" : "s"} need chasing
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Partners</p>
                <p className="font-semibold">{formatCurrency(overview.position.creditOutstandingPartner)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Field customers</p>
                <p className="font-semibold">{formatCurrency(overview.position.creditOutstandingField)}</p>
              </div>
            </div>
            <Link
              href="/finance/credit"
              className="flex items-center justify-between rounded-lg border border-border/60 p-3 text-sm font-medium transition hover:bg-muted/40"
            >
              Manage credit & settlements
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="size-4" /> Recent financial activity
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
                    <span className="text-muted-foreground">
                      · {e.reference}
                      {e.method ? ` · ${e.method}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary">{e.category}</Badge>
                    <span className={`font-semibold ${e.amount >= 0 ? "text-success" : "text-destructive"}`}>
                      {e.amount >= 0 ? "+" : "−"}
                      {formatCurrency(Math.abs(e.amount))}
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
  );
}
