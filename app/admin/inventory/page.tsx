import { Package, Boxes, Truck } from "lucide-react";
import { prisma } from "@/lib/db";
import { getStockTotals } from "@/lib/services/inventory";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { InventoryManager } from "@/components/admin/inventory-manager";
import { formatNumber } from "@/lib/utils";

export default async function AdminInventoryPage() {
  const [products, totals] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: "asc" },
      include: { inventory: true },
    }),
    getStockTotals(),
  ]);

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
      <InventoryManager products={dto} />
    </div>
  );
}
