import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import {
  MyRequests,
  type MyRequestDTO,
} from "@/components/dashboard/my-requests";

export default async function AgentRequestsPage() {
  const user = await requireRole("PARTNER");
  const requests = await prisma.request.findMany({
    where: { requesterId: user.id },
    orderBy: { createdAt: "desc" },
    include: { items: { include: { product: true } } },
  });

  const dto: MyRequestDTO[] = requests.map((r) => ({
    id: r.id,
    code: r.code,
    status: r.status,
    paymentType: r.paymentType,
    note: r.note,
    adminNote: r.adminNote,
    totalAmount: r.totalAmount,
    createdAt: r.createdAt.toISOString(),
    items: r.items.map((i) => ({
      name: i.product.name,
      sku: i.product.sku,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="My orders"
        description="Track every request from submission to fulfilment."
      />
      <MyRequests requests={dto} />
    </div>
  );
}
