import Link from "next/link";
import { Undo2, Package } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { REP_RETURN_TYPE } from "@/lib/rep-returns";
import { getRepReturnableStock } from "@/lib/services/rep-returns";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { RepReturnForm } from "@/components/field/rep-return-form";
import { RepReturnHistory } from "@/components/field/rep-return-history";

export const dynamic = "force-dynamic";

export default async function RepReturnStockPage() {
  const me = await requireRole("SALES_REP");

  const [returnable, products, warehouses, returns] = await Promise.all([
    getRepReturnableStock(me.id),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ notForSale: "asc" }, { name: "asc" }],
      select: { id: true, name: true, unitsPerCarton: true, notForSale: true },
    }),
    prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    prisma.returnRequest.findMany({
      where: { requesterId: me.id, reasonType: REP_RETURN_TYPE },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { product: { select: { name: true } } },
    }),
  ]);

  const options = products
    .filter((p) => (returnable.get(p.id)?.available ?? 0) > 0)
    .map((p) => ({ ...p, available: returnable.get(p.id)!.available }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Return stock"
        description="Send unsold stock back to the warehouse. They accept it, you bring it in, they confirm — then it leaves your stock."
      >
        <Link href="/rep/stock" className="text-sm font-medium text-primary hover:underline">
          Back to My stock
        </Link>
      </PageHeader>

      {options.length === 0 ? (
        <EmptyState
          className="rounded-2xl border border-dashed border-border py-10"
          icon={Package}
          title="Nothing to return"
          description="You have no stock in hand that isn't already in a return."
        />
      ) : (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
          <RepReturnForm products={options} warehouses={warehouses} />
        </div>
      )}

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
          <Undo2 className="size-4 text-primary" /> Your returns
        </h2>
        {returns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No returns yet.</p>
        ) : (
          <RepReturnHistory
            rows={returns.map((r) => ({
              id: r.id,
              code: r.code,
              productName: r.product.name,
              quantity: r.quantity,
              status: r.status,
              warehouseName: r.warehouseName,
              reason: r.reason,
              adminNote: r.adminNote,
              createdAt: r.createdAt.toISOString(),
            }))}
          />
        )}
      </section>
    </div>
  );
}
