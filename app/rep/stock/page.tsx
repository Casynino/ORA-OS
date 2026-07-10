import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StockRequestForm } from "@/components/field/field-forms";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Package } from "lucide-react";
import { formatNumber, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RepStockPage() {
  const me = await requireRole("SALES_REP");

  const [stock, products, issues, requests] = await Promise.all([
    prisma.repStock.findMany({
      where: { repId: me.id },
      include: { product: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ notForSale: "asc" }, { price: "desc" }],
      select: {
        id: true,
        name: true,
        unitsPerCarton: true,
        notForSale: true,
        inventory: { select: { warehouseQty: true } },
      },
    }),
    prisma.repStockIssue.findMany({
      where: { repId: me.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { product: { select: { name: true } } },
    }),
    prisma.repStockRequest.findMany({
      where: { repId: me.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { items: { include: { product: { select: { name: true } } } } },
    }),
  ]);

  const productOpts = products.map((p) => ({
    id: p.id,
    name: p.name,
    unitsPerCarton: p.unitsPerCarton,
    notForSale: p.notForSale,
    available: p.inventory?.warehouseQty ?? 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="My stock"
        description="Everything the warehouse has issued to you, and what's left in your hands."
      />

      {/* In hand */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">In hand now</h2>
        {stock.length === 0 ? (
          <EmptyState
            className="rounded-2xl border border-dashed border-border py-10"
            icon={Package}
            title="No stock yet"
            description="Request stock below — the ORA team will issue it to you."
          />
        ) : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {stock.map((s) => (
              <div key={s.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                <p className="truncate font-semibold">{s.product.name}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-muted/50 p-2">
                    <p className="font-display text-xl font-bold">{formatNumber(s.sellableQty)}</p>
                    <p className="text-[10px] text-muted-foreground">Sellable</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2">
                    <p className="font-display text-xl font-bold">{formatNumber(s.sampleQty)}</p>
                    <p className="text-[10px] text-muted-foreground">Samples</p>
                  </div>
                </div>
                <p className="mt-2.5 text-xs text-muted-foreground">
                  received {formatNumber(s.receivedQty)} · sold {formatNumber(s.soldQty)} · sampled {formatNumber(s.sampledQty)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Request stock */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Request stock</h2>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
          <StockRequestForm products={productOpts} />
        </div>
      </section>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* My requests */}
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">My requests</h2>
          <div className="space-y-2">
            {requests.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                No stock requests yet.
              </p>
            ) : (
              requests.map((r) => (
                <div key={r.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {r.code} · {r.items.length} product{r.items.length === 1 ? "" : "s"} · {timeAgo(r.createdAt)}
                    </p>
                    <StatusBadge status={r.status} />
                  </div>
                  <ul className="mt-1.5 space-y-0.5">
                    {r.items.map((it) => (
                      <li key={it.id} className="flex items-center justify-between text-sm">
                        <span className="min-w-0 truncate">{it.product.name}</span>
                        <span className="shrink-0 font-medium">
                          {formatNumber(it.quantity)} pcs
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Issue history */}
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">Received from warehouse</h2>
          <div className="space-y-2">
            {issues.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                Issued stock will appear here.
              </p>
            ) : (
              issues.map((i) => (
                <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {formatNumber(i.quantity)} × {i.product.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {i.code} · {timeAgo(i.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={i.kind} />
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
