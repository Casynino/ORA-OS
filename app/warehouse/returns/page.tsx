import { ClipboardList } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ReturnsManager } from "@/components/admin/returns-manager";

export const dynamic = "force-dynamic";

export default async function WarehouseReturnsPage() {
  const session = await requireRole("WAREHOUSE");
  const me = await prisma.user.findUnique({
    where: { id: session.id },
    include: { warehouse: true },
  });
  if (!me?.warehouse) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No warehouse assigned"
        description="Ask an ORA admin to assign you to a warehouse."
      />
    );
  }

  // Warehouse staff only see returns routed to their own warehouse, and never
  // the monetary value — their role is inventory reconciliation only.
  const returns = await prisma.returnRequest.findMany({
    where: { warehouseName: me.warehouse.name },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      product: { select: { name: true } },
      requester: { select: { name: true } },
    },
  });

  const dto = returns.map((r) => ({
    id: r.id,
    code: r.code,
    productName: r.product.name,
    requesterName: r.requester.name,
    quantity: r.quantity,
    reasonType: r.reasonType,
    reason: r.reason,
    warehouseName: r.warehouseName,
    value: 0, // never shown to warehouse staff
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Returns"
        description={`Confirm receipt of authorised returns into ${me.warehouse.name} to reconcile stock. Each decision is logged.`}
      />
      <ReturnsManager returns={dto} detailBase="/warehouse/returns" showValue={false} />
    </div>
  );
}
