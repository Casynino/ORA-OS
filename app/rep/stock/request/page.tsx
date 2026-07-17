import Link from "next/link";
import { History } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StockRequestForm } from "@/components/field/field-forms";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RepRequestStockPage() {
  await requireRole("SALES_REP");

  const products = await prisma.product.findMany({
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
  });

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Request stock"
        description="Ask the warehouse to prepare stock for you to collect."
      >
        <Link href="/rep/stock/requests" className={cn(buttonVariants({ size: "sm", variant: "outline" }), "rounded-full")}>
          <History className="size-4" /> Request history
        </Link>
      </PageHeader>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
        <StockRequestForm products={productOpts} />
      </div>
    </div>
  );
}
