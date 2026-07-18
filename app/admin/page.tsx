import Link from "next/link";
import { AlertTriangle, Clock, Wallet, PackageX, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { getCommandCenter } from "@/lib/services/command-center";
import { getFinanceOverview } from "@/lib/services/finance";
import { getOperationalFund } from "@/lib/services/operational-fund";
import {
  getCollectionsIntelligence,
  getCustomerIntelligence,
  getBusinessTrends,
} from "@/lib/services/intelligence";
import {
  BusinessHealth,
  NeedsAttention,
  ExecutiveActions,
  OperationsStatus,
  RevenueCollectionOverview,
  InventoryOverview,
  SalesPerformance,
  ProductPerformance,
  type AttentionItem,
} from "@/components/admin/ceo-overview";
import { RevenueTrends, HumanActivityFeed, CustomerIntelligencePanel } from "@/components/admin/command-sections";
import { AddExpenseButton, IssueFundsButton, AddCapitalButton } from "@/components/admin/finance-forms";
import { getSelectableAccounts } from "@/lib/services/accounts";
import { getSelectableCategories } from "@/lib/services/categories";
import { Reveal } from "@/components/ui/reveal";
import { formatCurrency, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminCommandCenter() {
  const me = await requireRole("ADMIN");

  const [d, fin, collections, customers, trends, opFund, accounts, categories, pettyPending, lastPaidPayroll, meUser] =
    await Promise.all([
      getCommandCenter(),
      getFinanceOverview("month"),
      getCollectionsIntelligence(),
      getCustomerIntelligence(),
      getBusinessTrends(),
      getOperationalFund(),
      getSelectableAccounts(),
      getSelectableCategories(),
      prisma.pettyCashRequest.count({ where: { status: "PENDING" } }),
      prisma.payrollRun.findFirst({
        where: { status: "PAID" },
        orderBy: { paidAt: "desc" },
        include: { items: { select: { net: true } } },
      }),
      prisma.user.findUnique({ where: { id: me.id }, select: { name: true, preferredName: true } }),
    ]);

  const firstName = meUser?.preferredName || (meUser?.name ?? "there").split(" ")[0];

  // Greeting + date (Tanzania time, EAT)
  const eatHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Dar_es_Salaam", hour: "2-digit", hour12: false }).format(new Date()),
  );
  const greeting = eatHour >= 5 && eatHour < 12 ? "Good morning" : eatHour >= 12 && eatHour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Dar_es_Salaam", weekday: "long", month: "long", day: "numeric",
  }).format(new Date());

  // ── "Needs attention" — the money/credit/stock decisions only the CEO makes.
  //    The operational pipeline (approvals, transfers, returns…) lives in its own
  //    Operations section below, so nothing is counted twice. ──────────────────
  const o = d.operations;
  const attention: AttentionItem[] = [];
  if (collections.overdueCount > 0)
    attention.push({ tone: "danger", icon: AlertTriangle, label: `${collections.overdueCount} overdue credit ${collections.overdueCount === 1 ? "account" : "accounts"}`, hint: "chase these before they age further", href: "/admin/credit" });
  if (collections.dueSoon.length > 0)
    attention.push({ tone: "warning", icon: Clock, label: `${collections.dueSoon.length} ${collections.dueSoon.length === 1 ? "customer" : "customers"} approaching payment`, hint: "payment dates coming up — plan the follow-ups", href: "/admin/credit" });
  if (pettyPending > 0)
    attention.push({ tone: "warning", icon: Wallet, label: `${pettyPending} operational fund ${pettyPending === 1 ? "request" : "requests"}`, hint: "Finance is waiting on your approval", href: "/admin/finance/operational-fund" });
  if (d.network.lowStock > 0)
    attention.push({ tone: "warning", icon: PackageX, label: `${d.network.lowStock} ${d.network.lowStock === 1 ? "product" : "products"} low on stock`, hint: "reorder before it runs out", href: "/admin/inventory" });

  const latestPayrollTotal = lastPaidPayroll?.items.reduce((s, i) => s + i.net, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* ── 1 · Welcome banner (no numbers — they live in Business health) ── */}
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-accent to-primary p-6 text-white shadow-glow sm:p-8">
          <div className="absolute inset-0 bg-grid opacity-20" />
          <div className="pointer-events-none absolute -right-12 -top-16 size-56 rounded-full bg-white/15 blur-3xl animate-float-slow" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 size-48 rounded-full bg-white/10 blur-3xl animate-float-slow-rev" />
          <div className="relative min-w-0">
            <p className="flex items-center gap-2 text-xs text-white/80 sm:text-sm">
              <span className="inline-block size-2 shrink-0 animate-pulse rounded-full bg-white" />
              <span className="min-w-0 truncate">{dateLabel}</span>
            </p>
            <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight sm:text-4xl">
              {greeting}, {firstName}. 👋
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-white/90 sm:text-base">
              Here&apos;s what&apos;s happening across ORA today.
            </p>
          </div>
        </div>
      </Reveal>

      {/* ── 2 · Business health summary ── */}
      <BusinessHealth
        cashAvailable={fin.position.businessCapital}
        outstandingCredit={collections.outstandingTotal}
        revenueMonth={d.sales.month.revenue}
        netProfit={fin.window.netProfit}
      />

      {/* ── 3 · Needs attention + quick actions (money + navigation) ── */}
      <NeedsAttention items={attention} />
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick actions</p>
        <div className="flex flex-wrap items-center gap-2">
          <AddExpenseButton accounts={accounts} categories={categories} label="Record expense" variant="default" className="rounded-xl" />
          <IssueFundsButton accounts={accounts} label="Issue funds" variant="accent" className="rounded-xl" />
          <AddCapitalButton accounts={accounts} label="Add capital" variant="outline" className="rounded-xl" />
          <ExecutiveActions />
        </div>
      </section>

      {/* ── 4 · Revenue & collection overview ── */}
      <RevenueCollectionOverview
        cashRevenue={d.sales.month.cashRevenue}
        creditRevenue={d.sales.month.creditRevenue}
        collectedMonth={d.finance.collectionsMonth}
        collectionRate={collections.collectionRate}
        dueThisWeek={collections.dueThisWeek}
        overdueTotal={collections.overdueTotal}
        overdueCount={collections.overdueCount}
        activeCreditCustomers={collections.activeCreditCustomers}
        goodPayers={collections.goodPayers}
        atRiskCustomers={collections.atRiskCustomers}
      />

      {/* ── 5 · Inventory overview (value + every location incl. on-credit) ── */}
      <InventoryOverview totalValue={fin.position.stockValue} inv={d.inventory} />

      {/* ── 6 · Sales performance ── */}
      <SalesPerformance
        today={d.sales.today}
        week={d.sales.week}
        avgSale={d.sales.avgOrderValue}
        topPartner={d.sales.topPartner}
      />

      {/* ── 6b · Operations · at a glance (the pipeline the CEO oversees) ── */}
      <OperationsStatus ops={o} />

      {/* ── 6c · Customer intelligence (who ORA sells to — types + top customers) ── */}
      <CustomerIntelligencePanel cust={customers} />

      {/* ── 7 · Product performance (visual — best / slow / low / returned / requested) ── */}
      <ProductPerformance
        best={d.productPerformance.best}
        slow={d.productPerformance.slow}
        low={d.productPerformance.low}
        returned={d.productPerformance.returned}
        requested={d.productPerformance.requested}
      />

      {/* ── 8 · Financial activity + oversight ── */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Financial activity</p>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <HumanActivityFeed
            rows={d.financialActivity}
            title="Recent money movements"
            empty="Confirmed sales, deposits, expenses and fund events will stream here."
          />
          <div className="space-y-4">
            <Link href="/admin/finance/operational-fund" className="glass-card block rounded-2xl p-5 transition-colors hover:border-primary/30">
              <h3 className="flex items-center gap-2 font-display font-semibold"><Wallet className="size-4" /> Operational Fund</h3>
              <p className="mt-2 font-display text-2xl font-bold">{formatCurrency(opFund.balance)}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(opFund.funded)} allocated · {formatCurrency(opFund.spent)} spent</p>
            </Link>
            <Link href="/admin/finance/payroll" className="glass-card block rounded-2xl p-5 transition-colors hover:border-primary/30">
              <h3 className="flex items-center gap-2 font-display font-semibold"><Users className="size-4" /> Latest payroll</h3>
              {lastPaidPayroll ? (
                <>
                  <p className="mt-2 font-display text-2xl font-bold">{formatCurrency(latestPayrollTotal)}</p>
                  <p className="text-xs text-muted-foreground">
                    {lastPaidPayroll.month}/{lastPaidPayroll.year} · {lastPaidPayroll.items.length} paid{lastPaidPayroll.paidAt ? ` · ${timeAgo(lastPaidPayroll.paidAt)}` : ""}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No payroll processed yet.</p>
              )}
            </Link>
          </div>
        </div>
      </section>

      {/* ── 9 · Charts & trends ── */}
      <RevenueTrends trends={trends} />
    </div>
  );
}
