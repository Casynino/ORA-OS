import {
  Package,
  Boxes,
  Layers,
  Wallet,
  TrendingUp,
  AlertTriangle,
  PackageX,
  Warehouse,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { InventoryManager } from "@/components/admin/inventory-manager";
import {
  formatNumber,
  formatCurrency,
  formatCompactCurrency,
} from "@/lib/utils";
import { piecesToCartons } from "@/lib/units";

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage() {
  const [products, warehouses, stock] = await Promise.all([
    prisma.product.findMany({
      orderBy: [{ notForSale: "asc" }, { name: "asc" }],
      include: { inventory: true },
    }),
    prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    prisma.warehouseStock.findMany({
      select: { warehouseId: true, productId: true, onHand: true },
    }),
  ]);

  // productId -> { warehouseId -> onHand }, so the Add/Adjust modals can show
  // (and validate against) the stock that physically sits in each warehouse.
  const stockByWarehouse: Record<string, Record<string, number>> = {};
  for (const s of stock) {
    (stockByWarehouse[s.productId] ??= {})[s.warehouseId] = s.onHand;
  }

  // ── Carton-aware KPIs from real opening stock ──────────────────────────────
  let totalPieces = 0;
  let totalCartons = 0;
  let inventoryValue = 0; // at buying cost
  let potentialSales = 0; // at selling price (sellable products only)
  let lowStock = 0;
  let outOfStock = 0;

  for (const p of products) {
    const qty = p.inventory?.warehouseQty ?? 0;
    const threshold = p.inventory?.lowStockThreshold ?? 50;
    totalPieces += qty;
    totalCartons += piecesToCartons(qty, p.unitsPerCarton);
    inventoryValue += qty * p.costPrice;
    if (!p.notForSale) potentialSales += qty * p.price;
    if (qty === 0) outOfStock += 1;
    else if (qty <= threshold) lowStock += 1;
  }
  const roundedCartons = Math.round(totalCartons * 10) / 10;

  const dto = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    category: p.category,
    unitLabel: p.unitLabel,
    iconKey: p.iconKey,
    isActive: p.isActive,
    notForSale: p.notForSale,
    unitsPerCarton: p.unitsPerCarton,
    costPrice: p.costPrice,
    price: p.price,
    description: p.description ?? "",
    warehouseQty: p.inventory?.warehouseQty ?? 0,
    assignedQty: p.inventory?.assignedQty ?? 0,
    distributedQty: p.inventory?.distributedQty ?? 0,
    lowStockThreshold: p.inventory?.lowStockThreshold ?? 50,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Every unit accounted for — stored in pieces, counted in cartons. All stock lives in the Main Warehouse."
      />

      {/* Value hero */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-accent to-primary p-5 text-white shadow-glow sm:p-6">
          <div className="absolute inset-0 bg-grid opacity-20" />
          <div className="relative">
            <p className="flex items-center gap-1.5 text-sm text-white/85">
              <Warehouse className="size-4" />
              Total inventory
            </p>
            <p className="mt-1.5 font-display text-4xl font-bold leading-none">
              {formatNumber(totalPieces)}
              <span className="ml-1.5 text-lg font-medium text-white/80">pieces</span>
            </p>
            <p className="mt-2 text-sm text-white/85">
              {formatNumber(roundedCartons)} cartons · {products.length} products
            </p>
          </div>
        </div>
        <StatCard
          label="Inventory value"
          value={formatCompactCurrency(inventoryValue)}
          hint="At buying cost"
          icon={Wallet}
          accent="info"
        />
        <StatCard
          label="Potential sales value"
          value={formatCompactCurrency(potentialSales)}
          hint="At selling price"
          icon={TrendingUp}
          accent="success"
        />
      </div>

      {/* Count KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total products"
          value={formatNumber(products.length)}
          icon={Package}
        />
        <StatCard
          label="Total cartons"
          value={formatNumber(roundedCartons)}
          icon={Boxes}
          accent="accent"
        />
        <StatCard
          label="Total pieces"
          value={formatNumber(totalPieces)}
          icon={Layers}
          accent="primary"
        />
        <StatCard
          label="Low stock"
          value={formatNumber(lowStock)}
          hint={`${outOfStock} out of stock`}
          icon={lowStock > 0 ? AlertTriangle : PackageX}
          accent={lowStock > 0 ? "warning" : "info"}
        />
      </div>

      <InventoryManager
        products={dto}
        warehouses={warehouses}
        stockByWarehouse={stockByWarehouse}
      />
    </div>
  );
}
