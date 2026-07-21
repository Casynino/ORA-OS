import Link from "next/link";
import { Wallet, Users } from "lucide-react";
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
  ExecutiveActions,
  OperationsStatus,
  RevenueCollectionOverview,
  InventoryOverview,
  SalesPerformance,
  ProductPerformance,
} from "@/components/admin/ceo-overview";
import { AttentionCenter, type AttnItem } from "@/components/admin/attention-center";
import { RevenueTrends, HumanActivityFeed, CustomerIntelligencePanel } from "@/components/admin/command-sections";
import { AddExpenseButton, IssueFundsButton, AddCapitalButton } from "@/components/admin/finance-forms";
import { getSelectableAccounts } from "@/lib/services/accounts";
import { getSelectableCategories } from "@/lib/services/categories";
import { DashboardHero } from "@/components/ui/dashboard-hero";
import { formatCurrency, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminCommandCenter() {
  const me = await requireRole("ADMIN");

  const [d, fin, collections, customers, trends, opFund, accounts, categories, pettyPendingAgg, pendingSaleGroups, pendingCollAgg, lastPaidPayroll, meUser] =
    await Promise.all([
      getCommandCenter(),
      getFinanceOverview("month"),
      getCollectionsIntelligence(),
      getCustomerIntelligence(),
      getBusinessTrends(),
      getOperationalFund(),
      getSelectableAccounts(),
      getSelectableCategories(),
      prisma.pettyCashRequest.aggregate({ _count: true, _sum: { amount: true }, where: { status: "PENDING" } }),
      // Rep-recorded money awaiting finance/CEO sign-off (not yet company money).
      prisma.fieldSale.groupBy({ by: ["type"], where: { financeStatus: "PENDING", voided: false }, _count: { _all: true }, _sum: { total: true } }),
      prisma.fieldPayment.aggregate({ _count: true, _sum: { amount: true }, where: { financeStatus: "PENDING", sale: { voided: false } } }),
      prisma.payrollRun.findFirst({
        where: { status: "PAID" },
        orderBy: { paidAt: "desc" },
        include: { items: { select: { net: true } } },
      }),
      prisma.user.findUnique({ where: { id: me.id }, select: { name: true, preferredName: true } }),
    ]);

  // Finance sign-off pipeline the CEO can see (and act on at /admin/sales-approvals).
  const cashGroup = pendingSaleGroups.find((g) => g.type === "CASH");
  const creditGroup = pendingSaleGroups.find((g) => g.type === "CREDIT");
  const pettyPending = pettyPendingAgg._count;
  const approvalCounts = {
    cashSales: { count: cashGroup?._count._all ?? 0, amount: cashGroup?._sum.total ?? 0 },
    creditSales: { count: creditGroup?._count._all ?? 0, amount: creditGroup?._sum.total ?? 0 },
    collections: { count: pendingCollAgg._count, amount: pendingCollAgg._sum.amount ?? 0 },
    fundRequests: { count: pettyPending, amount: pettyPendingAgg._sum.amount ?? 0 },
  };

  const firstName = meUser?.preferredName || (meUser?.name ?? "there").split(" ")[0];

  // Greeting + date (Tanzania time, EAT)
  const eatHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Dar_es_Salaam", hour: "2-digit", hour12: false }).format(new Date()),
  );
  const greeting = eatHour >= 5 && eatHour < 12 ? "Good morning" : eatHour >= 12 && eatHour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Dar_es_Salaam", weekday: "long", month: "long", day: "numeric",
  }).format(new Date());

  // ── "Needs your attention" — one bounded command center merging the CEO's
  //    credit/stock alerts with the finance sign-off pipeline. Priority order:
  //    overdue money → sign-offs → fund requests → due-soon → low stock. It scrolls
  //    internally, so a busy queue never pushes the rest of the dashboard down. ──
  const o = d.operations;
  const attnItems: AttnItem[] = [];
  if (collections.overdueCount > 0)
    attnItems.push({ key: "overdue", category: "overdue", iconKey: "overdue", tone: "danger", label: `${collections.overdueCount} overdue credit ${collections.overdueCount === 1 ? "account" : "accounts"}`, hint: "chase these before they age further", amount: collections.overdueTotal || null, href: "/admin/credit" });
  if (approvalCounts.cashSales.count > 0)
    attnItems.push({ key: "cash", category: "signoff", iconKey: "cash", tone: "warning", label: `${approvalCounts.cashSales.count} cash ${approvalCounts.cashSales.count === 1 ? "sale" : "sales"} to confirm`, hint: "rep money awaiting your verification", amount: approvalCounts.cashSales.amount, href: "/admin/sales-approvals" });
  if (approvalCounts.creditSales.count > 0)
    attnItems.push({ key: "credit", category: "signoff", iconKey: "credit", tone: "info", label: `${approvalCounts.creditSales.count} credit ${approvalCounts.creditSales.count === 1 ? "sale" : "sales"} to approve`, hint: "become receivables once you approve the terms", amount: approvalCounts.creditSales.amount, href: "/admin/sales-approvals" });
  if (approvalCounts.collections.count > 0)
    attnItems.push({ key: "collect", category: "signoff", iconKey: "collect", tone: "info", label: `${approvalCounts.collections.count} ${approvalCounts.collections.count === 1 ? "collection" : "collections"} to verify`, hint: "rep-collected repayments awaiting sign-off", amount: approvalCounts.collections.amount, href: "/admin/sales-approvals" });
  if (approvalCounts.fundRequests.count > 0)
    attnItems.push({ key: "fund", category: "funds", iconKey: "fund", tone: "warning", label: `${approvalCounts.fundRequests.count} operational fund ${approvalCounts.fundRequests.count === 1 ? "request" : "requests"}`, hint: "Finance is waiting on your approval", amount: approvalCounts.fundRequests.amount, href: "/admin/finance/operational-fund" });
  if (collections.dueSoon.length > 0)
    attnItems.push({ key: "dueSoon", category: "dueSoon", iconKey: "dueSoon", tone: "warning", label: `${collections.dueSoon.length} ${collections.dueSoon.length === 1 ? "customer" : "customers"} approaching payment`, hint: "payment dates coming up — plan the follow-ups", amount: null, href: "/admin/credit" });
  if (d.network.lowStock > 0)
    attnItems.push({ key: "stock", category: "stock", iconKey: "stock", tone: "warning", label: `${d.network.lowStock} ${d.network.lowStock === 1 ? "product" : "products"} low on stock`, hint: "reorder before it runs out", amount: null, href: "/admin/inventory" });

  const latestPayrollTotal = lastPaidPayroll?.items.reduce((s, i) => s + i.net, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* ── 1 · Welcome banner (no numbers — they live in Business health) ── */}
      <DashboardHero
        eyebrow={dateLabel}
        pill="CEO"
        title={<>{greeting}, {firstName}. 👋</>}
        subtitle="Here's what's happening across ORA today."
      />

      {/* ── 2 · Business health summary ── */}
      <BusinessHealth
        cashAvailable={fin.position.businessCapital}
        outstandingCredit={collections.outstandingTotal}
        revenueMonth={d.sales.month.revenue}
        netProfit={fin.window.netProfit}
      />

      {/* ── 3 · Needs your attention — alerts + finance sign-off, one bounded panel ── */}
      <AttentionCenter items={attnItems} />

      {/* ── 3b · Quick actions (money + navigation) ── */}
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
