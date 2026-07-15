import { ShoppingCart, Lock, TrendingUp } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { productMeta } from "@/lib/product-meta";
import { WALKIN_EMAIL } from "@/lib/constants";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { RecordCashSale } from "@/components/admin/record-cash-sale";
import { SalesTable, type SaleRow } from "@/components/admin/sales-table";
import { formatCurrency } from "@/lib/utils";

export default async function WarehouseSalesPage() {
  const session = await requireRole("WAREHOUSE");
  const me = await prisma.user.findUnique({
    where: { id: session.id },
    include: { warehouse: true },
  });

  if (!me?.canRecordSales) {
    return (
      <div className="space-y-6">
        <PageHeader title="Sales" description="Record a completed cash or field sale." />
        <EmptyState
          icon={Lock}
          title="No sales permission"
          description="Recording sales isn't enabled for your account. Ask an ORA admin to grant the permission."
        />
      </div>
    );
  }

  const whName = me.warehouse?.name ?? "";
  const [partners, products, partnerPrices, sales, receivingAccounts] = await Promise.all([
    prisma.user.findMany({
      where: { role: "PARTNER", status: "ACTIVE", email: { not: WALKIN_EMAIL } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.warehouseStock.findMany({
      where: { warehouseId: me.warehouse?.id ?? "" },
      include: { product: { select: { id: true, name: true, sku: true, price: true } } },
      orderBy: { onHand: "desc" },
    }),
    prisma.partnerPrice.findMany(),
    // Sales fulfilled at / recorded for this warehouse.
    prisma.request.findMany({
      where: { status: "FULFILLED", warehouseName: whName },
      orderBy: { fulfilledAt: "desc" },
      include: { requester: { select: { name: true, email: true } } },
    }),
    prisma.paymentAccount.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, accountName: true, accountNumber: true },
    }),
  ]);

  const saleProducts = products.map((s) => ({
    id: s.product.id,
    name: s.product.name,
    size: productMeta(s.product.sku).size,
    price: s.product.price,
    stock: s.onHand,
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
  const totalValue = sales.reduce((s, r) => s + (r.totalAmount ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales"
        description={`Cash, field and fulfilled sales at ${whName}. Recording a sale draws stock down here; prices are admin-set.`}
      >
        <RecordCashSale
          partners={partners}
          products={saleProducts}
          priceMap={priceMap}
          receivingAccounts={receivingAccounts}
        />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Sales at this warehouse" value={String(sales.length)} icon={ShoppingCart} accent="primary" />
        <StatCard label="Total value" value={formatCurrency(totalValue)} icon={TrendingUp} accent="success" />
      </div>

      <SalesTable rows={rows} detailBase="/warehouse/sales" />
    </div>
  );
}
