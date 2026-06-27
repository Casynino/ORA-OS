import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getReturnableStock } from "@/lib/returns-stock";
import { productMeta } from "@/lib/product-meta";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ReturnForm,
  type ReturnableProduct,
} from "@/components/dashboard/return-form";

export default async function NewReturnPage() {
  const session = await requireRole("PARTNER");
  const me = await prisma.user.findUnique({ where: { id: session.id } });
  if (!me) notFound();

  const [returnable, products, warehouses] = await Promise.all([
    getReturnableStock(me.id),
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, sku: true },
    }),
    prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
  ]);

  const productById = new Map(products.map((p) => [p.id, p]));
  const ownedProducts: ReturnableProduct[] = [...returnable.values()]
    .filter((l) => l.available > 0)
    .map((l) => {
      const p = productById.get(l.productId);
      return {
        id: l.productId,
        name: p?.name ?? "Product",
        sku: p?.sku ?? "",
        available: l.available,
        image: productMeta(p?.sku ?? "").image,
      };
    });

  const warehouseNames = warehouses.map((w) => w.name);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Request a return"
        description="You can only return stock you currently hold. The ORA team reviews every request before any stock is sent back."
      >
        <Link
          href="/partner/returns"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to returns
        </Link>
      </PageHeader>

      <Card className="mx-auto w-full max-w-xl">
        <CardHeader>
          <CardTitle>Return details</CardTitle>
        </CardHeader>
        <CardContent>
          <ReturnForm
            products={ownedProducts}
            warehouses={
              warehouseNames.length > 0 ? warehouseNames : ["Main warehouse"]
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
