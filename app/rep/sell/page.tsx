import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { FieldSaleForm } from "@/components/field/sale-form";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RepSellPage() {
  const me = await requireRole("SALES_REP");

  const [stock, customers, recent, accounts] = await Promise.all([
    prisma.repStock.findMany({
      where: { repId: me.id, sellableQty: { gt: 0 } },
      include: { product: true },
      orderBy: { product: { price: "desc" } },
    }),
    prisma.fieldCustomer.findMany({
      where: { repId: me.id },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        businessName: true,
        phone: true,
        location: true,
        creditSuspended: true,
      },
    }),
    prisma.fieldSale.findMany({
      where: { repId: me.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { customer: { select: { name: true } } },
    }),
    prisma.paymentAccount.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, accountName: true, accountNumber: true },
    }),
  ]);

  const products = stock.map((s) => ({
    id: s.productId,
    name: s.product.name,
    sku: s.product.sku,
    unitLabel: s.product.unitLabel,
    price: s.product.price,
    inHand: s.sellableQty,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Record a sale"
        description="Cash or credit — stock is deducted the moment you save it."
      />

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
        <FieldSaleForm products={products} customers={customers} accounts={accounts} />
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">My recent sales</h2>
        <div className="space-y-2">
          {recent.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Your sales will appear here.
            </p>
          ) : (
            recent.map((s) => (
              <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{s.code}</span>
                    <StatusBadge status={s.type} />
                    {s.creditStatus && <StatusBadge status={s.creditStatus} />}
                    {s.voided && <Badge variant="destructive">Voided</Badge>}
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(s.total)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.customer?.name ?? s.customerName ?? "Walk-in"}
                  {s.location ? ` · ${s.location}` : ""} · {timeAgo(s.createdAt)}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
