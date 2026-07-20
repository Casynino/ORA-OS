import Link from "next/link";
import { ClipboardList, Package, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/admin/kpi-card";
import { RepStockOrders } from "@/components/admin/rep-stock-orders";
import {
  AdminRequestsList,
  type RequestDTO,
} from "@/components/admin/admin-requests-list";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const [requests, creditAgg, repRequests] = await Promise.all([
    prisma.request.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        requester: {
          select: { name: true, organization: true, role: true, status: true, location: true, creditLimit: true },
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
    prisma.repStockRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        rep: { select: { name: true } },
        warehouse: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
    }),
  ]);

  const outstandingByAgent = new Map(
    creditAgg.map((c) => [c.agentId, (c._sum.principal ?? 0) - (c._sum.amountPaid ?? 0)]),
  );

  const dto: RequestDTO[] = requests.map((r) => ({
    id: r.id,
    code: r.code,
    type: r.type,
    status: r.status,
    paymentType: r.paymentType,
    paymentStatus: r.paymentStatus,
    paymentClaimedAt: r.paymentClaimedAt ? r.paymentClaimedAt.toISOString() : null,
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
    items: r.items.map((i) => ({ id: i.id, name: i.product.name, sku: i.product.sku, quantity: i.quantity, unitPrice: i.unitPrice })),
  }));

  const partnerPending = requests.filter((r) => r.status === "PENDING" || r.status === "PRICED").length;
  const repPending = repRequests.filter((r) => r.status === "PENDING").length;

  const repOrders = repRequests.map((r) => ({
    id: r.id,
    code: r.code,
    repName: r.rep.name,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    warehouseName: r.warehouse?.name ?? null,
    items: r.items.map((i) => ({ name: i.product.name, quantity: i.quantity })),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Every order in one place — partner/agent orders and sales-rep stock requests. Review, price, approve and fulfil; Admin has authority over all of it."
      />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Partner orders" value={requests.length} icon={ClipboardList} accent="primary" />
        <KpiCard label="Partner orders to action" value={partnerPending} icon={ClipboardList} accent={partnerPending > 0 ? "warning" : "success"} />
        <KpiCard label="Rep stock requests" value={repRequests.length} icon={Package} accent="accent" />
        <KpiCard label="Rep requests to review" value={repPending} icon={Package} accent={repPending > 0 ? "warning" : "success"} />
      </div>

      {/* Partner / agent orders */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <ClipboardList className="size-5 text-primary" /> Partner &amp; agent orders
        </h2>
        <AdminRequestsList requests={dto} />
      </section>

      {/* Sales-rep stock requests */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Package className="size-5 text-accent" /> Sales-rep stock requests
          </h2>
          <Link href="/admin/reps" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            Prepare / issue at Sales Reps <ArrowRight className="size-4" />
          </Link>
        </div>
        <RepStockOrders orders={repOrders} />
      </section>
    </div>
  );
}
