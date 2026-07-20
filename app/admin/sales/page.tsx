import { ShoppingCart, TrendingUp, Banknote, CreditCard, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/db";
import { productMeta } from "@/lib/product-meta";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/admin/kpi-card";
import { RecordCashSale } from "@/components/admin/record-cash-sale";
import { SalesHistoryTable } from "@/components/admin/sales-history-table";
import { getSalesHistory } from "@/lib/services/sales-history";
import { WALKIN_EMAIL } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AdminSalesHistoryPage() {
  const [rows, partners, products, partnerPrices, receivingAccounts] = await Promise.all([
    getSalesHistory(),
    prisma.user.findMany({
      where: { role: "PARTNER", status: "ACTIVE", email: { not: WALKIN_EMAIL } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({ where: { isActive: true }, include: { inventory: true }, orderBy: { price: "desc" } }),
    prisma.partnerPrice.findMany(),
    prisma.paymentAccount.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, accountName: true, accountNumber: true },
    }),
  ]);

  // Headline figures — revenue counts CONFIRMED sales only; outstanding is what
  // credit customers still owe across everything shown.
  const confirmed = rows.filter((r) => r.confirmed);
  const revenue = confirmed.reduce((s, r) => s + r.total, 0);
  const cashTotal = confirmed.filter((r) => r.paymentType === "CASH").reduce((s, r) => s + r.total, 0);
  const creditTotal = confirmed.filter((r) => r.paymentType === "CREDIT").reduce((s, r) => s + r.total, 0);
  // Owed on CONFIRMED credit only — reconciles with credit sales (owed ≤ sold).
  const outstanding = confirmed.filter((r) => r.paymentType === "CREDIT").reduce((s, r) => s + r.balance, 0);

  const saleProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    size: productMeta(p.sku).size,
    price: p.price,
    stock: p.inventory?.warehouseQty ?? 0,
  }));
  const priceMap: Record<string, number> = {};
  for (const pp of partnerPrices) priceMap[`${pp.partnerId}:${pp.productId}`] = pp.price;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales history"
        description="Every sale, every channel — field, office, partner and direct. Who sold what, to whom, how much, when, and whether the money is in."
      >
        <RecordCashSale partners={partners} products={saleProducts} priceMap={priceMap} receivingAccounts={receivingAccounts} />
      </PageHeader>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Total sales" value={rows.length} icon={ShoppingCart} accent="primary" />
        <KpiCard label="Revenue (confirmed)" value={revenue} prefix="TSh " icon={TrendingUp} accent="success" />
        <KpiCard label="Cash sales" value={cashTotal} prefix="TSh " icon={Banknote} accent="success" />
        <KpiCard label="Credit sales" value={creditTotal} prefix="TSh " icon={CreditCard} accent="accent" />
        <KpiCard label="Outstanding credit" value={outstanding} prefix="TSh " icon={AlertTriangle} accent={outstanding > 0 ? "warning" : "success"} />
      </div>

      <SalesHistoryTable rows={rows} />
    </div>
  );
}
