import {
  ClipboardList,
  PackageCheck,
  Package,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FulfillRequestButton,
  RejectStockRequestButton,
} from "@/components/admin/rep-controls";
import { formatNumber, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Sales-rep stock requests — the warehouse queue. Staff review availability,
 * approve (reserving the pieces here) or reject; reps collect in person and
 * confirm receipt, which is when the stock actually moves.
 */
export default async function WarehouseRepRequestsPage() {
  const session = await requireRole("WAREHOUSE");
  const me = await prisma.user.findUnique({
    where: { id: session.id },
    include: { warehouse: true },
  });

  if (!me?.warehouse) {
    return (
      <div className="space-y-6">
        <PageHeader title="Rep stock requests" description="Approve and prepare stock for sales-rep collection." />
        <EmptyState
          icon={Package}
          title="No warehouse assigned"
          description="Your account isn't linked to a warehouse yet. Ask an ORA admin to assign you to one."
        />
      </div>
    );
  }
  const wh = me.warehouse;

  const [pending, ready, recentIssued, myStock] = await Promise.all([
    prisma.repStockRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: {
        rep: { select: { name: true } },
        items: { include: { product: { select: { name: true, unitsPerCarton: true } } } },
      },
    }),
    prisma.repStockRequest.findMany({
      where: { status: "READY", warehouseId: wh.id },
      orderBy: { preparedAt: "asc" },
      include: {
        rep: { select: { name: true } },
        preparedBy: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
    }),
    prisma.repStockRequest.findMany({
      where: { status: "ISSUED", warehouseId: wh.id },
      orderBy: { collectedAt: "desc" },
      take: 10,
      include: {
        rep: { select: { name: true } },
        preparedBy: { select: { name: true } },
        items: { select: { issuedQty: true } },
      },
    }),
    prisma.warehouseStock.findMany({
      where: { warehouseId: wh.id },
      select: { productId: true, onHand: true, reserved: true },
    }),
  ]);

  // Free-to-promise in THIS warehouse: on hand minus already-reserved pickups.
  const freeById = new Map(
    myStock.map((s) => [s.productId, Math.max(0, s.onHand - s.reserved)]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rep stock requests"
        description={`Approve and prepare stock for collection at ${wh.name}. Approved pieces are reserved here until the rep collects and confirms.`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Awaiting review" value={formatNumber(pending.length)} icon={ClipboardList} accent={pending.length > 0 ? "warning" : "success"} />
        <StatCard label="Awaiting pickup" value={formatNumber(ready.length)} icon={Clock} accent={ready.length > 0 ? "info" : "success"} />
        <StatCard label="Collected (recent)" value={formatNumber(recentIssued.length)} icon={CheckCircle2} accent="success" />
      </div>

      {/* Pending — review & approve */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
          <ClipboardList className="size-5 text-warning" />
          Awaiting review
        </h2>
        {pending.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No requests waiting"
            description="New sales-rep stock requests land here for you to review."
          />
        ) : (
          <div className="space-y-2">
            {pending.map((r) => (
              <div key={r.id} className="rounded-2xl border border-warning/30 bg-warning/[0.04] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {r.rep.name} · {r.items.length} product{r.items.length === 1 ? "" : "s"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.code}
                      {r.note ? ` · "${r.note}"` : ""} · {timeAgo(r.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <FulfillRequestButton
                      requestId={r.id}
                      repName={r.rep.name}
                      items={r.items.map((it) => ({
                        productId: it.productId,
                        productName: it.product.name,
                        unitsPerCarton: it.product.unitsPerCarton,
                        requested: it.quantity,
                        available: freeById.get(it.productId) ?? 0,
                        isSample: it.kind === "SAMPLE",
                      }))}
                    />
                    <RejectStockRequestButton id={r.id} />
                  </div>
                </div>
                <ul className="mt-2.5 space-y-1 border-t border-warning/20 pt-2.5">
                  {r.items.map((it) => {
                    const free = freeById.get(it.productId) ?? 0;
                    const short = free < it.quantity;
                    return (
                      <li key={it.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">
                          {it.product.name}
                          {it.kind === "SAMPLE" && (
                            <span className="ml-1.5 text-xs text-muted-foreground">(sample)</span>
                          )}
                        </span>
                        <span className={`shrink-0 text-xs ${short ? "text-destructive" : "text-muted-foreground"}`}>
                          {formatNumber(it.quantity)} pcs requested · {formatNumber(free)} free here
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Ready — awaiting rep pickup */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
          <Clock className="size-5 text-info" />
          Prepared — awaiting pickup
        </h2>
        {ready.length === 0 ? (
          <EmptyState
            icon={PackageCheck}
            title="Nothing awaiting pickup"
            description="Approved requests wait here until the rep collects and confirms receipt."
          />
        ) : (
          <div className="space-y-2">
            {ready.map((r) => {
              const units = r.items.reduce((s, i) => s + i.issuedQty, 0);
              return (
                <div key={r.id} className="rounded-2xl border border-info/30 bg-info/[0.04] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        {r.rep.name}
                        <Badge variant="info">ready</Badge>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.code} · {formatNumber(units)} pcs reserved · prepared by{" "}
                        {r.preparedBy?.name ?? "ORA team"}{" "}
                        {r.preparedAt ? timeAgo(r.preparedAt) : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Hand over — the rep confirms on their phone
                      </span>
                      <RejectStockRequestButton id={r.id} label="Cancel" />
                    </div>
                  </div>
                  <ul className="mt-2.5 space-y-1 border-t border-info/20 pt-2.5">
                    {r.items
                      .filter((it) => it.issuedQty > 0)
                      .map((it) => (
                        <li key={it.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate">{it.product.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatNumber(it.issuedQty)} pcs
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recently collected */}
      {recentIssued.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
            <CheckCircle2 className="size-5 text-success" />
            Recently collected
          </h2>
          <div className="rounded-2xl border border-border bg-card">
            <ul className="divide-y divide-border/60">
              {recentIssued.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium">{r.rep.name}</span>{" "}
                    <span className="text-muted-foreground">
                      collected {formatNumber(r.items.reduce((s, i) => s + i.issuedQty, 0))} pcs · {r.code}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    issued by {r.preparedBy?.name ?? "ORA team"} ·{" "}
                    {r.collectedAt ? timeAgo(r.collectedAt) : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
