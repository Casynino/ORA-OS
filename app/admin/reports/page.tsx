import Link from "next/link";
import { Package, ShoppingCart, Wallet, HeartHandshake, TrendingUp, ScrollText, CreditCard, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { getStockTotals } from "@/lib/services/inventory";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/admin/kpi-card";
import { ReportsManager } from "@/components/admin/reports-manager";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const [stock, salesAgg, impactAgg, creditAgg, products, reportSettings, reportRows] =
    await Promise.all([
      getStockTotals(),
      prisma.request.aggregate({ _sum: { totalAmount: true }, _count: true, where: { status: "FULFILLED" } }),
      prisma.impactActivity.aggregate({
        _sum: { padsDistributed: true, peopleReached: true },
        where: { isPublished: true },
      }),
      prisma.creditAccount.aggregate({ _sum: { principal: true, amountPaid: true }, where: { status: { not: "SETTLED" } } }),
      prisma.product.findMany({ include: { inventory: true } }),
      prisma.reportSettings.findUnique({ where: { id: "singleton" } }),
      prisma.report.findMany({ orderBy: { createdAt: "desc" }, take: 200, select: { id: true, type: true, title: true, periodStart: true, createdAt: true, whatsappSent: true } }),
    ]);

  const reportsForClient = reportRows.map((r) => ({
    id: r.id, type: r.type, title: r.title,
    periodStart: r.periodStart.toISOString(), createdAt: r.createdAt.toISOString(), whatsappSent: r.whatsappSent,
  }));
  const settingsForClient = reportSettings
    ? { dailyEnabled: reportSettings.dailyEnabled, dailyHourEat: reportSettings.dailyHourEat, monthlyEnabled: reportSettings.monthlyEnabled, creditReminderEnabled: reportSettings.creditReminderEnabled, fundRequestAlerts: reportSettings.fundRequestAlerts, repReportAlerts: reportSettings.repReportAlerts, paymentConfirmAlerts: reportSettings.paymentConfirmAlerts }
    : null;

  const inventoryValue = products.reduce((s, p) => s + (p.inventory?.warehouseQty ?? 0) * p.costPrice, 0);
  const outstanding = (creditAgg._sum.principal ?? 0) - (creditAgg._sum.amountPaid ?? 0);

  const detailedReports = [
    { label: "Profit & Loss", hint: "revenue, costs, net profit", href: "/admin/finance/profit", icon: TrendingUp },
    { label: "General Ledger", hint: "every money movement", href: "/admin/finance/ledger", icon: ScrollText },
    { label: "Sales performance", hint: "orders, revenue, reps", href: "/admin/sales", icon: ShoppingCart },
    { label: "Credit & settlements", hint: "outstanding, collections", href: "/admin/credit", icon: CreditCard },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Reports" description="Automated executive reports (WhatsApp + archived PDFs), a live business snapshot, and links to your detailed reports — all in one place." />

      {/* ── 1 · Report Center (the archive + automation) ── */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Report Center · automated WhatsApp &amp; PDF archive</p>
        <ReportsManager settings={settingsForClient} reports={reportsForClient} />
      </section>

      {/* ── 2 · Detailed reports (jump to the full report pages) ── */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detailed reports</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {detailedReports.map((r) => (
            <Link key={r.href} href={r.href} className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-card/50 p-4 transition-colors hover:border-primary/40">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><r.icon className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.label}</p>
                <p className="truncate text-xs text-muted-foreground">{r.hint}</p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </section>

      {/* ── 3 · Live business snapshot (at-a-glance figures) ── */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live business snapshot</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Stock on hand" value={stock.warehouse} suffix=" units" icon={Package} accent="primary" />
          <KpiCard label="With partners" value={stock.assigned} suffix=" units" icon={Package} accent="warning" />
          <KpiCard label="Distributed" value={stock.distributed} suffix=" units" icon={Package} accent="success" />
          <KpiCard label="Inventory value" value={inventoryValue} prefix="TSh " icon={Wallet} accent="info" />
          <KpiCard label="Confirmed sales" value={salesAgg._count} icon={ShoppingCart} accent="primary" />
          <KpiCard label="Revenue (all time)" value={salesAgg._sum.totalAmount ?? 0} prefix="TSh " icon={ShoppingCart} accent="success" />
          <KpiCard label="Outstanding credit" value={outstanding} prefix="TSh " icon={Wallet} accent="warning" />
          <KpiCard label="People reached" value={impactAgg._sum.peopleReached ?? 0} icon={HeartHandshake} accent="accent" />
        </div>
      </section>
    </div>
  );
}
