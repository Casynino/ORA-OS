import { Package, Lock } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber, humanize, timeAgo } from "@/lib/utils";

const DOT: Record<string, string> = {
  "ORA-PURPLE-360": "bg-[#7B61FF]",
  "ORA-BLUE-290": "bg-[#3B82F6]",
  "ORA-LINER-180": "bg-[#FF4DBD]",
};

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: { sku: "asc" },
    include: {
      inventory: true,
      movements: { take: 5, orderBy: { createdAt: "desc" } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="The fixed Ora product set — stock, pricing and movement history."
      >
        <Badge variant="secondary" className="gap-1.5">
          <Lock className="size-3" />
          System-locked · 3 products
        </Badge>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-3">
        {products.map((p) => {
          const inv = p.inventory;
          const onHand = inv?.warehouseQty ?? 0;
          const margin = p.price > 0 ? ((p.price - p.costPrice) / p.price) * 100 : 0;
          return (
            <div key={p.id} className="glass-card rounded-2xl p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-white ${DOT[p.sku] ?? "bg-primary"}`}>
                  <Package className="size-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate font-display font-semibold">{p.name}</h3>
                  <p className="text-xs text-muted-foreground">{p.sku} · {p.unitLabel}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="font-display text-lg font-bold">{formatNumber(onHand)}</p>
                  <p className="text-[10px] text-muted-foreground">On hand</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="font-display text-lg font-bold">{formatNumber(inv?.assignedQty ?? 0)}</p>
                  <p className="text-[10px] text-muted-foreground">Assigned</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="font-display text-lg font-bold">{formatNumber(inv?.distributedQty ?? 0)}</p>
                  <p className="text-[10px] text-muted-foreground">Distributed</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-lg border border-border/60 p-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Cost</p><p className="font-medium">{formatCurrency(p.costPrice)}</p></div>
                <div className="text-center"><p className="text-xs text-muted-foreground">Sell</p><p className="font-medium">{formatCurrency(p.price)}</p></div>
                <div className="text-right"><p className="text-xs text-muted-foreground">Margin</p><p className="font-medium text-success">{margin.toFixed(0)}%</p></div>
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent movements</p>
                <div className="mt-2 space-y-1.5">
                  {p.movements.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No movements yet.</p>
                  ) : (
                    p.movements.map((m) => (
                      <div key={m.id} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{humanize(m.type)} · {timeAgo(m.createdAt)}</span>
                        <span className="font-medium">{m.type === "DISTRIBUTED" || m.type === "ASSIGNED" ? "−" : "+"}{formatNumber(m.quantity)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
