import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StockRequestForm } from "@/components/field/field-forms";
import { ConfirmCollectionButton } from "@/components/field/confirm-collection";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Package, MapPin } from "lucide-react";
import { formatNumber, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RepStockPage() {
  const me = await requireRole("SALES_REP");

  const [stock, products, issues, requests] = await Promise.all([
    prisma.repStock.findMany({
      where: { repId: me.id },
      include: { product: true },
      orderBy: [{ product: { notForSale: "asc" } }, { updatedAt: "desc" }],
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ notForSale: "asc" }, { price: "desc" }],
      select: {
        id: true,
        name: true,
        unitsPerCarton: true,
        notForSale: true,
        inventory: { select: { warehouseQty: true, lowStockThreshold: true } },
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
      include: {
        items: { include: { product: { select: { name: true } } } },
        warehouse: { select: { name: true, location: true } },
      },
    }),
  ]);

  const readyForPickup = requests.filter((r) => r.status === "READY");

  // Reps only see availability status — never the actual warehouse quantities.
  const productOpts = products.map((p) => {
    const qty = p.inventory?.warehouseQty ?? 0;
    const threshold = p.inventory?.lowStockThreshold ?? 50;
    return {
      id: p.id,
      name: p.name,
      unitsPerCarton: p.unitsPerCarton,
      notForSale: p.notForSale,
      stock: (qty === 0 ? "OUT" : qty <= threshold ? "LOW" : "IN") as
        | "IN"
        | "LOW"
        | "OUT",
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="My stock"
        description="Everything the warehouse has issued to you, and what's left in your hands."
      />

      {/* Ready for pickup — collect at the warehouse and confirm in person */}
      {readyForPickup.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">
            Ready for pickup
          </h2>
          <div className="space-y-2">
            {readyForPickup.map((r) => {
              const units = r.items.reduce((s, i) => s + i.issuedQty, 0);
              return (
                <div key={r.id} className="rounded-2xl border border-info/40 bg-info/[0.05] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-semibold">
                        <MapPin className="size-4 text-info" />
                        Collect at {r.warehouse?.name ?? "the ORA warehouse"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {r.code} · {formatNumber(units)} pcs prepared
                        {r.warehouse?.location ? ` · ${r.warehouse.location}` : ""}
                      </p>
                    </div>
                    <ConfirmCollectionButton requestId={r.id} />
                  </div>
                  <ul className="mt-2.5 space-y-0.5 border-t border-info/20 pt-2.5">
                    {r.items
                      .filter((it) => it.issuedQty > 0)
                      .map((it) => (
                        <li key={it.id} className="flex items-center justify-between text-sm">
                          <span className="min-w-0 truncate">{it.product.name}</span>
                          <span className="shrink-0 font-medium">
                            {formatNumber(it.issuedQty)} pcs
                          </span>
                        </li>
                      ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Tap &ldquo;Confirm receipt&rdquo; only when the products are in your hands —
                    that&apos;s when they move into your stock.
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

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
            {stock.map((s) => {
              const inHand = s.sellableQty + s.sampleQty;
              const isSample = s.product.notForSale;
              const cartons = Math.floor(inHand / s.product.unitsPerCarton);
              const loose = inHand % s.product.unitsPerCarton;
              return (
                <div key={s.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                  <p className="truncate font-semibold">{s.product.name}</p>
                  <div className="mt-3 rounded-lg bg-muted/50 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Available
                    </p>
                    {isSample ? (
                      <p className="font-display text-2xl font-bold">
                        {formatNumber(inHand)}
                        <span className="ml-1 text-sm font-medium text-muted-foreground">
                          sample packs
                        </span>
                      </p>
                    ) : (
                      <p className="font-display text-2xl font-bold">
                        {formatNumber(cartons)}
                        <span className="ml-1 mr-2 text-sm font-medium text-muted-foreground">
                          carton{cartons === 1 ? "" : "s"}
                        </span>
                        {formatNumber(loose)}
                        <span className="ml-1 text-sm font-medium text-muted-foreground">
                          pcs
                        </span>
                      </p>
                    )}
                    {!isSample && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatNumber(inHand)} pieces total
                      </p>
                    )}
                  </div>
                  <p className="mt-2.5 text-xs text-muted-foreground">
                    received {formatNumber(s.receivedQty)} ·{" "}
                    {isSample
                      ? `distributed ${formatNumber(s.sampledQty)}`
                      : `sold ${formatNumber(s.soldQty)}`}
                  </p>
                </div>
              );
            })}
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
