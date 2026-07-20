import { ShoppingCart, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/db";
import { productMeta } from "@/lib/product-meta";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/admin/kpi-card";
import { RecordCashSale } from "@/components/admin/record-cash-sale";
import { SalesTable, type SaleRow } from "@/components/admin/sales-table";
import { WALKIN_EMAIL } from "@/lib/constants";

export default async function AdminSalesPage() {
  const [sales, partners, products, partnerPrices, receivingAccounts] = await Promise.all([
    prisma.request.findMany({
      where: { status: "FULFILLED" },
      orderBy: { fulfilledAt: "desc" },
      include: { requester: { select: { name: true, email: true } } },
    }),
    prisma.user.findMany({
      where: {
        role: "PARTNER",
        status: "ACTIVE",
        email: { not: WALKIN_EMAIL },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      include: { inventory: true },
      orderBy: { price: "desc" },
    }),
    prisma.partnerPrice.findMany(),
    prisma.paymentAccount.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, accountName: true, accountNumber: true },
    }),
  ]);
  const total = sales.reduce((s, r) => s + (r.totalAmount ?? 0), 0);

  const saleProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    size: productMeta(p.sku).size,
    price: p.price,
    stock: p.inventory?.warehouseQty ?? 0,
  }));
  const priceMap: Record<string, number> = {};
  for (const pp of partnerPrices) {
    priceMap[`${pp.partnerId}:${pp.productId}`] = pp.price;
  }

  const rows: SaleRow[] = sales.map((r) => {
    const isWalkin = r.requester.email === WALKIN_EMAIL;
    return {
      id: r.id,
      code: r.code.replace("REQ", "SALE"),
      buyer: isWalkin
        ? r.deliverTo?.trim() || "Walk-in customer"
        : r.requester.name,
      isWalkin,
      paymentType: r.paymentType,
      total: r.totalAmount ?? 0,
      dateISO: (r.fulfilledAt ?? r.createdAt).toISOString(),
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Sales history" description="Confirmed sales — fulfilled partner orders and recorded cash sales. Open any row for the full record.">
        <RecordCashSale
          partners={partners}
          products={saleProducts}
          priceMap={priceMap}
          receivingAccounts={receivingAccounts}
        />
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard label="Confirmed sales" value={sales.length} icon={ShoppingCart} accent="primary" />
        <KpiCard label="Total value" value={total} prefix="TSh " icon={TrendingUp} accent="success" />
      </div>
      <SalesTable rows={rows} />
    </div>
  );
}
