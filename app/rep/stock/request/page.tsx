import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StockRequestForm } from "@/components/field/field-forms";
import { StockRequestHistory } from "@/components/field/stock-request-history";

export const dynamic = "force-dynamic";

export default async function RepRequestStockPage() {
  const me = await requireRole("SALES_REP");

  const [products, requests, issues] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ notForSale: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        unitsPerCarton: true,
        notForSale: true,
        // Reps only ever see availability status — never the actual warehouse quantity.
        inventory: { select: { warehouseQty: true, lowStockThreshold: true } },
      },
    }),
    prisma.repStockRequest.findMany({
      where: { repId: me.id },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { items: { include: { product: { select: { name: true } } } } },
    }),
    prisma.repStockIssue.findMany({
      where: { repId: me.id },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { product: { select: { name: true } } },
    }),
  ]);

  const productOpts = products.map((p) => {
    const qty = p.inventory?.warehouseQty ?? 0;
    const threshold = p.inventory?.lowStockThreshold ?? 50;
    return {
      id: p.id,
      name: p.name,
      unitsPerCarton: p.unitsPerCarton,
      notForSale: p.notForSale,
      stock: (qty === 0 ? "OUT" : qty <= threshold ? "LOW" : "IN") as "IN" | "LOW" | "OUT",
    };
  });

  const reqDTO = requests.map((r) => ({
    id: r.id,
    code: r.code,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    items: r.items.map((it) => ({ name: it.product.name, quantity: it.quantity })),
  }));
  const issueDTO = issues.map((i) => ({
    id: i.id,
    code: i.code,
    kind: i.kind,
    quantity: i.quantity,
    name: i.product.name,
    createdAt: i.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Request stock"
        description="Ask the warehouse to prepare stock for you to collect — your full request history is below."
      />

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
        <StockRequestForm products={productOpts} />
      </div>

      <section className="space-y-3 pt-2">
        <h2 className="font-display text-lg font-semibold">Request history</h2>
        <StockRequestHistory requests={reqDTO} issues={issueDTO} />
      </section>
    </div>
  );
}
