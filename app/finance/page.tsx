import Link from "next/link";
import {
  Banknote,
  Landmark,
  Smartphone,
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
    accounts,
    accountReceipts,
    pendingPayments,
    claimedPayments,
    pendingSettlements,
    approvedPayroll,
    pendingPayroll,
    openPettyCash,
  ] = await Promise.all([
    getFinanceOverview("month"),
    getLedger("month", 8),
    getLedger("week", 2000),
    prisma.paymentAccount.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    Promise.all([
      prisma.fieldSale.groupBy({
        by: ["paymentAccountId"],
        where: { voided: false, type: "CASH", paymentAccountId: { not: null } },
        _sum: { total: true },
      }),
      prisma.fieldPayment.groupBy({
        by: ["paymentAccountId"],
        where: { paymentAccountId: { not: null }, sale: { voided: false } },
        _sum: { amount: true },
      }),
      prisma.payment.groupBy({
        by: ["paymentAccountId"],
        where: { paymentAccountId: { not: null } },
        _sum: { amount: true },
      }),
      prisma.request.groupBy({
        by: ["paymentAccountId"],
        where: { paymentAccountId: { not: null }, paymentStatus: "PAID" },
        _sum: { totalAmount: true },
      }),
    ]),
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
    prisma.settlementRequest.count({ where: { status: "PENDING" } }),
    prisma.payrollRun.findMany({
      where: { status: "APPROVED" },
      include: { items: { select: { net: true } } },
    }),
    prisma.payrollRun.findMany({
      where: { status: "PENDING_APPROVAL" },
      include: { items: { select: { net: true } } },
    }),
    prisma.pettyCashRequest.findMany({
      where: { status: "APPROVED" },
      include: { expenses: { select: { amount: true } } },
    }),
  ]);

  // Received-to-date per account type (the money-in trace per account).
  const receivedByAccount = new Map<string, number>();
  const [fs, fp, pp, op] = accountReceipts;
  for (const r of fs) receivedByAccount.set(r.paymentAccountId!, (receivedByAccount.get(r.paymentAccountId!) ?? 0) + (r._sum.total ?? 0));
  for (const r of fp) receivedByAccount.set(r.paymentAccountId!, (receivedByAccount.get(r.paymentAccountId!) ?? 0) + (r._sum.amount ?? 0));
  for (const r of pp) receivedByAccount.set(r.paymentAccountId!, (receivedByAccount.get(r.paymentAccountId!) ?? 0) + (r._sum.amount ?? 0));
  for (const r of op) receivedByAccount.set(r.paymentAccountId!, (receivedByAccount.get(r.paymentAccountId!) ?? 0) + (r._sum.totalAmount ?? 0));
  const receivedByType = (type: string) =>
    accounts
      .filter((a) => a.type === type)
      .reduce((s, a) => s + (receivedByAccount.get(a.id) ?? 0), 0);

  // Accounts payable = approved-but-unpaid payroll (a real committed
  // liability). Petty cash floats were already expensed at issue — they're
  // cash sitting with the custodian, not money owed.
  const payrollDue = approvedPayroll.reduce(
    (s, r) => s + r.items.reduce((x, i) => x + i.net, 0),
    0,
  );
  const payrollAwaiting = pendingPayroll.reduce(
    (s, r) => s + r.items.reduce((x, i) => x + i.net, 0),
    0,
  );
  const pettyCashOpen = openPettyCash.reduce(
    (s, r) => s + Math.max(0, r.amount - r.expenses.reduce((x, e) => x + e.amount, 0)),
    0,
  );
  const accountsPayable = payrollDue;

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

  const pendingCreditReviews = pendingSettlements + overview.position.overdueCount;

  return (
    <div className="space-y-7">
      <PageHeader
        title={`Karibu, ${me.name?.split(" ")[0] ?? "Finance"}`}
        description="ORA's money at a glance — cash, collections, credit and what needs your confirmation today."
      />

      {/* Attention strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/finance/payments" className="transition-transform hover:-translate-y-0.5">
          <StatCard
            label="Pending payment confirmations"
            value={formatNumber(pendingPayments)}
            hint={claimedPayments > 0 ? `${claimedPayments} claimed by customers` : "orders awaiting payment"}
            icon={ClipboardCheck}
            accent={pendingPayments > 0 ? "warning" : "success"}
          />
        </Link>
        <Link href="/finance/credit" className="transition-transform hover:-translate-y-0.5">
          <StatCard
            label="Pending credit reviews"
            value={formatNumber(pendingCreditReviews)}
            hint={`${pendingSettlements} settlements · ${overview.position.overdueCount} overdue`}
            icon={CreditCard}
            accent={pendingCreditReviews > 0 ? "warning" : "success"}
          />
        </Link>
        <Link href="/finance/payroll" className="transition-transform hover:-translate-y-0.5">
          <StatCard
            label="Accounts payable"
            value={formatCurrency(accountsPayable)}
            hint={`approved payroll · ${formatCurrency(payrollAwaiting)} more awaiting approval · ${formatCurrency(pettyCashOpen)} petty cash float`}
            icon={ArrowUpFromLine}
            accent={accountsPayable > 0 ? "info" : "success"}
          />
        </Link>
      </div>

      {/* Money position */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Cash available" value={formatCurrency(overview.position.cashAvailable)} hint="all money in − all money out" icon={Wallet} accent="primary" />
        <StatCard label="Cash received" value={formatCurrency(receivedByType("CASH"))} hint="via cash accounts, to date" icon={Banknote} accent="success" />
        <StatCard label="Bank received" value={formatCurrency(receivedByType("BANK"))} hint="via bank accounts, to date" icon={Landmark} accent="info" />
        <StatCard label="Mobile money received" value={formatCurrency(receivedByType("MOBILE_MONEY"))} hint="via Lipa numbers, to date" icon={Smartphone} accent="accent" />
      </div>

      {/* Today + month */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's collections" value={formatCurrency(overview.today.moneyIn - overview.today.capitalIn)} hint="customer money in" icon={ArrowDownToLine} accent="success" />
        <StatCard label="Today's payments" value={formatCurrency(overview.today.moneyOut)} icon={ArrowUpFromLine} accent="warning" />
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
            <Receipt className="size-4" /> Recent transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <EmptyState icon={Receipt} title="No transactions yet" description="Money movements appear here as they happen." />
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
