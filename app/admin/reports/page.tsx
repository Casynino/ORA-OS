import { Package, ShoppingCart, Wallet, HeartHandshake } from "lucide-react";
import { prisma } from "@/lib/db";
import { getStockTotals } from "@/lib/services/inventory";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/admin/kpi-card";
import { formatCurrency, formatNumber } from "@/lib/utils";

export default async function AdminReportsPage() {
  const [stock, salesAgg, donationMoney, donationPads, creditAgg, products] =
    await Promise.all([
      getStockTotals(),
      prisma.request.aggregate({ _sum: { totalAmount: true }, _count: true, where: { status: "FULFILLED" } }),
      prisma.donation.aggregate({ _sum: { amount: true }, where: { type: "MONEY" } }),
      prisma.donation.aggregate({ _sum: { quantity: true }, where: { type: "PADS" } }),
      prisma.creditAccount.aggregate({ _sum: { principal: true, amountPaid: true }, where: { status: { not: "SETTLED" } } }),
      prisma.product.findMany({ include: { inventory: true } }),
    ]);

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
      <PageHeader title="Reports" description="Live snapshot of stock, sales and finance across Ora." />

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
        <KpiCard label="Money donated" value={donationMoney._sum.amount ?? 0} prefix="TSh " icon={HeartHandshake} accent="accent" />
        <KpiCard label="Pads donated" value={donationPads._sum.quantity ?? 0} icon={HeartHandshake} accent="accent" />
      </Section>
    </div>
  );
}
