import Link from "next/link";
import { History } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { FieldSaleForm } from "@/components/field/sale-form";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RepSellPage() {
  const me = await requireRole("SALES_REP");

  const [stock, customers, accounts] = await Promise.all([
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
      >
        <Link href="/rep/sales" className={cn(buttonVariants({ size: "sm", variant: "outline" }), "rounded-full")}>
          <History className="size-4" /> Sales history
        </Link>
      </PageHeader>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
        <FieldSaleForm products={products} customers={customers} accounts={accounts} />
      </div>
    </div>
  );
}
