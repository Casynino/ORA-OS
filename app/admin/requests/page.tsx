import Link from "next/link";
import { ClipboardList, Package, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/admin/kpi-card";
import { RejectStockRequestButton } from "@/components/admin/rep-controls";
import {
  AdminRequestsList,
  type RequestDTO,
} from "@/components/admin/admin-requests-list";
import { formatNumber, formatDate, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

const REP_STATUS: Record<string, { label: string; tone: "warning" | "info" | "success" | "destructive" | "secondary" }> = {
  PENDING: { label: "Awaiting review", tone: "warning" },
  READY: { label: "Prepared · awaiting pickup", tone: "info" },
  ISSUED: { label: "Collected", tone: "success" },
  REJECTED: { label: "Rejected", tone: "destructive" },
};

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
        {repRequests.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No stock requests from sales reps.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Request</th>
                  <th className="px-3 py-2.5 font-medium">Rep</th>
                  <th className="px-3 py-2.5 font-medium">Items</th>
                  <th className="px-3 py-2.5 text-right font-medium">Pieces</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {repRequests.map((r) => {
                  const pieces = r.items.reduce((s, i) => s + i.quantity, 0);
                  const st = REP_STATUS[r.status] ?? { label: r.status, tone: "secondary" as const };
                  return (
                    <tr key={r.id} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2.5 align-top">
                        <p className="font-display font-semibold">{r.code}</p>
                        <p className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.createdAt)} · {timeAgo(r.createdAt)}</p>
                      </td>
                      <td className="px-3 py-2.5 align-top">{r.rep.name}</td>
                      <td className="px-3 py-2.5 align-top text-muted-foreground">
                        {r.items.map((i) => `${i.product.name} ×${formatNumber(i.quantity)}`).join(" · ")}
                        {r.warehouse && <span className="block text-xs">from {r.warehouse.name}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right align-top tabular-nums">{formatNumber(pieces)}</td>
                      <td className="px-3 py-2.5 align-top"><Badge variant={st.tone}>{st.label}</Badge></td>
                      <td className="px-3 py-2.5 align-top text-right">
                        {r.status === "PENDING" && <RejectStockRequestButton id={r.id} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
