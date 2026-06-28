import { Package, Boxes, Truck } from "lucide-react";
import { prisma } from "@/lib/db";
import { getStockTotals } from "@/lib/services/inventory";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { InventoryManager } from "@/components/admin/inventory-manager";
import { formatNumber } from "@/lib/utils";

export default async function AdminInventoryPage() {
  const [products, totals, warehouses, stock] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: "asc" },
      include: { inventory: true },
    }),
    getStockTotals(),
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

  const dto = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    category: p.category,
    unitLabel: p.unitLabel,
    isActive: p.isActive,
    warehouseQty: p.inventory?.warehouseQty ?? 0,
    assignedQty: p.inventory?.assignedQty ?? 0,
    distributedQty: p.inventory?.distributedQty ?? 0,
    lowStockThreshold: p.inventory?.lowStockThreshold ?? 50,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Every unit accounted for — warehouse, assigned and distributed."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="In warehouse"
          value={formatNumber(totals.warehouse)}
          icon={Package}
        />
        <StatCard
          label="Assigned to orders"
          value={formatNumber(totals.assigned)}
          icon={Boxes}
          accent="warning"
        />
        <StatCard
          label="Distributed"
          value={formatNumber(totals.distributed)}
          icon={Truck}
          accent="success"
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
