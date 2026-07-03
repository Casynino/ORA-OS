import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { SampleForm } from "@/components/field/field-forms";
import { StatCard } from "@/components/ui/stat-card";
import { Gift, MapPin } from "lucide-react";
import { startOfMonth } from "@/lib/services/field";
import { formatNumber, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RepSamplesPage() {
  const me = await requireRole("SALES_REP");

  const [stock, logs, monthAgg, totalAgg] = await Promise.all([
    prisma.repStock.findMany({
      where: { repId: me.id, sampleQty: { gt: 0 } },
      include: { product: { select: { id: true, name: true } } },
    }),
    prisma.sampleLog.findMany({
      where: { repId: me.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { product: { select: { name: true } } },
    }),
    prisma.sampleLog.aggregate({
      _sum: { quantity: true },
      where: { repId: me.id, createdAt: { gte: startOfMonth() } },
    }),
    prisma.sampleLog.aggregate({ _sum: { quantity: true }, where: { repId: me.id } }),
  ]);

  const products = stock.map((s) => ({
    id: s.productId,
    name: s.product.name,
    inHand: s.sampleQty,
  }));
  const inHand = stock.reduce((s, r) => s + r.sampleQty, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Samples"
        description="Every free pad you hand out is tracked — location, reason and quantity."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Samples in hand" value={formatNumber(inHand)} icon={Gift} accent="accent" />
        <StatCard label="Distributed this month" value={formatNumber(monthAgg._sum.quantity ?? 0)} icon={Gift} accent="primary" />
        <StatCard label="Distributed all-time" value={formatNumber(totalAgg._sum.quantity ?? 0)} icon={MapPin} accent="success" />
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Record a distribution</h2>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You have no sample stock in hand — request sample stock from the My stock page.
            </p>
          ) : (
            <SampleForm products={products} />
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Distribution history</h2>
        <div className="space-y-2">
          {logs.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Your sample distributions will appear here.
            </p>
          ) : (
            logs.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {formatNumber(l.quantity)} × {l.product.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {l.location}
                    {l.reason ? ` · ${l.reason}` : ""} · {timeAgo(l.createdAt)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
