import Link from "next/link";
import { Package, MapPin, Gift, PlusCircle } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmCollectionButton } from "@/components/field/confirm-collection";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RepStockPage() {
  const me = await requireRole("SALES_REP");

  const [stock, ready] = await Promise.all([
    prisma.repStock.findMany({
      where: { repId: me.id },
      include: { product: { select: { name: true, unitsPerCarton: true, notForSale: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.repStockRequest.findMany({
      where: { repId: me.id, status: "READY" },
      orderBy: { createdAt: "desc" },
      include: {
        items: { include: { product: { select: { name: true } } } },
        warehouse: { select: { name: true, location: true } },
      },
    }),
  ]);

  const forSale = stock.filter((s) => !s.product.notForSale);
  const samples = stock.filter((s) => s.product.notForSale);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My stock"
        description="What's in your hands right now."
      >
        <Link href="/rep/stock/request" className={cn(buttonVariants({ size: "sm" }), "rounded-full")}>
          <PlusCircle className="size-4" /> Request stock
        </Link>
      </PageHeader>

      {/* Ready for pickup */}
      {ready.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">Ready for pickup</h2>
          <div className="space-y-2">
            {ready.map((r) => {
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
                          <span className="shrink-0 font-medium">{formatNumber(it.issuedQty)} pcs</span>
                        </li>
                      ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Tap &ldquo;Confirm receipt&rdquo; only when the products are in your hands.
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Products for sale */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Products for sale</h2>
        {forSale.length === 0 ? (
          <EmptyState
            className="rounded-2xl border border-dashed border-border py-10"
            icon={Package}
            title="No stock yet"
            description="Request stock — the ORA team will issue it to you."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {forSale.map((s) => {
              const inHand = s.sellableQty;
              const perCarton = s.product.unitsPerCarton || 24;
              const cartons = Math.floor(inHand / perCarton);
              const loose = inHand % perCarton;
              return (
                <div key={s.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                  <p className="truncate font-semibold">{s.product.name}</p>
                  <div className="mt-3 rounded-lg bg-muted/50 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Available</p>
                    <p className="font-display text-2xl font-bold">
                      {formatNumber(cartons)}
                      <span className="ml-1 mr-2 text-sm font-medium text-muted-foreground">
                        carton{cartons === 1 ? "" : "s"}
                      </span>
                      {formatNumber(loose)}
                      <span className="ml-1 text-sm font-medium text-muted-foreground">pcs</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{formatNumber(inHand)} pieces total</p>
                  </div>
                  <p className="mt-2.5 text-xs text-muted-foreground">
                    received {formatNumber(s.receivedQty)} · sold {formatNumber(s.soldQty)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Sample packs — free, not for sale, pieces only */}
      {samples.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Gift className="size-4 text-accent" />
            <h2 className="font-display text-lg font-semibold">Sample packs</h2>
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
              Free · Not for sale
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {samples.map((s) => (
              <div key={s.id} className="rounded-2xl border border-accent/30 bg-accent/[0.03] p-4">
                <p className="truncate font-semibold">{s.product.name}</p>
                <div className="mt-3 rounded-lg bg-muted/50 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Available pieces</p>
                  <p className="font-display text-2xl font-bold">
                    {formatNumber(s.sampleQty)}
                    <span className="ml-1 text-sm font-medium text-muted-foreground">pcs</span>
                  </p>
                </div>
                <p className="mt-2.5 text-xs text-muted-foreground">
                  received {formatNumber(s.receivedQty)} · distributed {formatNumber(s.sampledQty)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
