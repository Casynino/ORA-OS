import { ClipboardList } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  WarehouseOrders,
  type WhOrderDTO,
} from "@/components/warehouse/warehouse-orders";

export default async function WarehouseOrdersPage() {
  const session = await requireRole("WAREHOUSE");
  const me = await prisma.user.findUnique({
    where: { id: session.id },
    include: { warehouse: true },
  });
  if (!me?.warehouse) {
    return <EmptyState icon={ClipboardList} title="No warehouse assigned" description="Ask an ORA admin to assign you to a warehouse." />;
  }

  const orders = await prisma.request.findMany({
    where: {
      warehouseName: me.warehouse.name,
      status: { in: ["APPROVED", "IN_TRANSIT", "FULFILLED"] },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      requester: { select: { name: true } },
      items: { include: { product: { select: { name: true } } } },
    },
  });

  const dto: WhOrderDTO[] = orders.map((o) => ({
    id: o.id,
    code: o.code,
    partner: o.requester.name,
    products: o.items.map((i) => `${i.product.name} ×${i.quantity}`).join(", "),
    totalQty: o.items.reduce((s, i) => s + i.quantity, 0),
    total: o.totalAmount,
    payment: o.paymentType,
    status: o.status,
    date: (o.fulfilledAt ?? o.createdAt).toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Order fulfillment"
        description={`Orders routed to ${me.warehouse.name}. Prepare, dispatch and confirm delivery.`}
      />
      <WarehouseOrders orders={dto} />
    </div>
  );
}
