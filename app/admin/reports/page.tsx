import { Package, ShoppingCart, Wallet, HeartHandshake } from "lucide-react";
import { prisma } from "@/lib/db";
import { getStockTotals } from "@/lib/services/inventory";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/admin/kpi-card";
import { ReportsManager } from "@/components/admin/reports-manager";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const [stock, salesAgg, impactAgg, activityCount, creditAgg, products, reportSettings, reportRows] =
    await Promise.all([
      getStockTotals(),
      prisma.request.aggregate({ _sum: { totalAmount: true }, _count: true, where: { status: "FULFILLED" } }),
      prisma.impactActivity.aggregate({
        _sum: { padsDistributed: true, peopleReached: true },
        where: { isPublished: true },
      }),
      prisma.impactActivity.count({ where: { isPublished: true } }),
      prisma.creditAccount.aggregate({ _sum: { principal: true, amountPaid: true }, where: { status: { not: "SETTLED" } } }),
      prisma.product.findMany({ include: { inventory: true } }),
      prisma.reportSettings.findUnique({ where: { id: "singleton" } }),
      prisma.report.findMany({ orderBy: { periodStart: "desc" }, take: 60, select: { id: true, type: true, title: true, periodStart: true, whatsappSent: true, pdfUrl: true } }),
    ]);

  const reportsForClient = reportRows.map((r) => ({
    id: r.id, type: r.type, title: r.title,
    // Always viewable — /r/[id] regenerates the PDF from archived data if it
    // wasn't stored in Blob.
    periodStart: r.periodStart.toISOString(), whatsappSent: r.whatsappSent, hasPdf: true,
  }));
  const settingsForClient = reportSettings
    ? { dailyEnabled: reportSettings.dailyEnabled, dailyHourEat: reportSettings.dailyHourEat, monthlyEnabled: reportSettings.monthlyEnabled, creditReminderEnabled: reportSettings.creditReminderEnabled, fundRequestAlerts: reportSettings.fundRequestAlerts, repReportAlerts: reportSettings.repReportAlerts }
    : null;

  const inventoryValue = products.reduce((s, p) => s + (p.inventory?.warehouseQty ?? 0) * p.costPrice, 0);
  const outstanding = (creditAgg._sum.principal ?? 0) - (creditAgg._sum.amountPaid ?? 0);

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </div>
  );

  return (
    <div className="space-y-7">
      <PageHeader title="Reports" description="Automated executive reports (WhatsApp + archived PDFs) plus a live snapshot of stock, sales and finance." />

      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Executive reports · WhatsApp &amp; PDF archive</p>
        <ReportsManager settings={settingsForClient} reports={reportsForClient} />
      </section>

      <Section title="Stock report">
        <KpiCard label="On hand" value={stock.warehouse} suffix=" units" icon={Package} accent="primary" />
        <KpiCard label="With partners" value={stock.assigned} suffix=" units" icon={Package} accent="warning" />
        <KpiCard label="Distributed" value={stock.distributed} suffix=" units" icon={Package} accent="success" />
        <KpiCard label="Inventory value" value={inventoryValue} prefix="TSh " icon={Wallet} accent="info" />
      </Section>

      <Section title="Sales & finance">
        <KpiCard label="Confirmed sales" value={salesAgg._count} icon={ShoppingCart} accent="primary" />
        <KpiCard label="Revenue" value={salesAgg._sum.totalAmount ?? 0} prefix="TSh " icon={ShoppingCart} accent="success" />
        <KpiCard label="Outstanding credit" value={outstanding} prefix="TSh " icon={Wallet} accent="warning" />
        <KpiCard label="Inventory value (cost)" value={inventoryValue} prefix="TSh " icon={Package} accent="info" />
      </Section>

      <Section title="Impact report">
        <KpiCard label="Impact activities" value={activityCount} icon={HeartHandshake} accent="accent" />
        <KpiCard label="Pads distributed (activities)" value={impactAgg._sum.padsDistributed ?? 0} icon={HeartHandshake} accent="accent" />
        <KpiCard label="People reached" value={impactAgg._sum.peopleReached ?? 0} icon={HeartHandshake} accent="success" />
      </Section>
    </div>
  );
}
