import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import {
  AdminRequestsList,
  type RequestDTO,
} from "@/components/admin/admin-requests-list";

export default async function AdminRequestsPage() {
  const [requests, creditAgg] = await Promise.all([
    prisma.request.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        requester: {
          select: {
            name: true,
            organization: true,
            role: true,
            status: true,
            location: true,
            creditLimit: true,
          },
        },
        items: { include: { product: true } },
        reviewedBy: { select: { name: true } },
      },
    }),
    prisma.creditAccount.groupBy({
      by: ["agentId"],
      where: { status: { not: "SETTLED" } },
      _sum: { principal: true, amountPaid: true },
    }),
  ]);

  const outstandingByAgent = new Map(
    creditAgg.map((c) => [
      c.agentId,
      (c._sum.principal ?? 0) - (c._sum.amountPaid ?? 0),
    ]),
  );

  const dto: RequestDTO[] = requests.map((r) => ({
    id: r.id,
    code: r.code,
    type: r.type,
    status: r.status,
    paymentType: r.paymentType,
    requesterName: r.requester.name,
    requesterOrg: r.requester.organization,
    requesterRole: r.requester.role,
    requesterStatus: r.requester.status,
    requesterLocation: r.requester.location,
    creditLimit: r.requester.creditLimit ?? 0,
    outstanding: outstandingByAgent.get(r.requesterId) ?? 0,
    note: r.note,
    adminNote: r.adminNote,
    deliverTo: r.deliverTo,
    deliverBy: r.deliverBy ? r.deliverBy.toISOString() : null,
    warehouseName: r.warehouseName,
    reviewedByName: r.reviewedBy?.name ?? null,
    totalAmount: r.totalAmount,
    createdAt: r.createdAt.toISOString(),
    items: r.items.map((i) => ({
      id: i.id,
      name: i.product.name,
      sku: i.product.sku,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock requests"
        description="Review, price, approve and fulfil every request. Admin is the sole financial authority."
      />
      <AdminRequestsList requests={dto} />
    </div>
  );
}
