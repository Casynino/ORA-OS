import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import {
  TransfersManager,
  type TransferDTO,
  type WarehouseLite,
} from "@/components/admin/transfers-manager";

export default async function AdminTransfersPage() {
  await requireRole("ADMIN");
  const [transfers, warehouses, stock] = await Promise.all([
    prisma.warehouseTransfer.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        from: { select: { name: true } },
        to: { select: { name: true } },
        createdBy: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
    }),
    prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    prisma.warehouseStock.findMany({
      where: { onHand: { gt: 0 } },
      include: { product: { select: { name: true } } },
    }),
  ]);

  const dto: TransferDTO[] = transfers.map((t) => ({
    id: t.id,
    code: t.code,
    from: t.from.name,
    to: t.to.name,
    status: t.status,
    note: t.note,
    createdBy: t.createdBy.name,
    createdAt: t.createdAt.toISOString(),
    items: t.items.map((i) => ({ name: i.product.name, quantity: i.quantity })),
  }));

  const warehouseLite: WarehouseLite[] = warehouses;
  const stockByWarehouse: Record<
    string,
    { productId: string; name: string; onHand: number }[]
  > = {};
  for (const s of stock) {
    (stockByWarehouse[s.warehouseId] ??= []).push({
      productId: s.productId,
      name: s.product.name,
      onHand: s.onHand,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transfers"
        description="Move stock between ORA warehouses. Stock only lands once the destination confirms receipt."
      />
      <TransfersManager
        transfers={dto}
        warehouses={warehouseLite}
        stockByWarehouse={stockByWarehouse}
      />
    </div>
  );
}
