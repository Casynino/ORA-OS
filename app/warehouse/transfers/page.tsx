import { ArrowLeftRight } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  WarehouseTransfers,
  type WhTransferDTO,
} from "@/components/warehouse/warehouse-transfers";
import { WarehouseNewTransfer } from "@/components/warehouse/warehouse-new-transfer";

export default async function WarehouseTransfersPage() {
  const session = await requireRole("WAREHOUSE");
  const me = await prisma.user.findUnique({
    where: { id: session.id },
    include: { warehouse: true },
  });
  if (!me?.warehouse) {
    return <EmptyState icon={ArrowLeftRight} title="No warehouse assigned" description="Ask an ORA admin to assign you to a warehouse." />;
  }

  const [transfers, destinations, myStock] = await Promise.all([
    prisma.warehouseTransfer.findMany({
      where: { OR: [{ fromId: me.warehouse.id }, { toId: me.warehouse.id }] },
      orderBy: { createdAt: "desc" },
      include: {
        from: { select: { name: true } },
        to: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
    }),
    prisma.warehouse.findMany({
      where: { isActive: true, id: { not: me.warehouse.id } },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    prisma.warehouseStock.findMany({
      where: { warehouseId: me.warehouse.id, onHand: { gt: 0 } },
      include: { product: { select: { name: true } } },
    }),
  ]);

  const dto: WhTransferDTO[] = transfers.map((t) => ({
    id: t.id,
    code: t.code,
    from: t.from.name,
    to: t.to.name,
    direction: t.fromId === me.warehouse!.id ? "OUT" : "IN",
    status: t.status,
    items: t.items.map((i) => ({ name: i.product.name, quantity: i.quantity })),
    createdAt: t.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transfers"
        description="Dispatch outgoing transfers and confirm receipt of incoming stock."
      >
        {me.canCreateTransfers && (
          <WarehouseNewTransfer
            fromId={me.warehouse.id}
            destinations={destinations}
            sourceStock={myStock.map((s) => ({
              productId: s.productId,
              name: s.product.name,
              onHand: s.onHand,
            }))}
          />
        )}
      </PageHeader>
      <WarehouseTransfers transfers={dto} />
    </div>
  );
}
