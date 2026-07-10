import { notFound } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import {
  PartnerCatalogue,
  type CatalogProduct,
} from "@/components/dashboard/partner-catalogue";
import { productMeta } from "@/lib/product-meta";
import { getProductBySku } from "@/lib/products";

export default async function PartnerCataloguePage() {
  const session = await requireRole("PARTNER");
  const me = await prisma.user.findUnique({ where: { id: session.id } });
  if (!me) notFound();

  const [products, partnerPrices, recent, fulfilledItems] =
    await Promise.all([
      prisma.product.findMany({
        where: { isActive: true, notForSale: false },
        orderBy: { price: "desc" },
      }),
      prisma.partnerPrice.findMany({ where: { partnerId: me.id } }),
      prisma.request.findMany({
        where: { requesterId: me.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { items: { select: { productId: true } } },
      }),
      prisma.requestItem.findMany({
        where: { request: { requesterId: me.id, status: "FULFILLED" } },
        select: { productId: true, quantity: true },
      }),
    ]);

  const ppMap = new Map(partnerPrices.map((p) => [p.productId, p.price]));
  const recentSet = new Set(
    recent.flatMap((r) => r.items.map((i) => i.productId)),
  );
  const totals = new Map<string, number>();
  for (const it of fulfilledItems) {
    totals.set(it.productId, (totals.get(it.productId) ?? 0) + it.quantity);
  }
  const bestSeller = [...totals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  const dto: CatalogProduct[] = products.map((p) => {
    const m = productMeta(p.sku);
    const rich = getProductBySku(p.sku);
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      description: p.description ?? "",
      unitLabel: p.unitLabel,
      image: m.image,
      size: m.size,
      color: m.color,
      use: m.use,
      accent: m.accent,
      price: ppMap.get(p.id) ?? p.price,
      features: rich?.features ?? [],
      packsPerCarton: rich?.packsPerCarton ?? 0,
      moq: rich?.moq ?? 1,
      leadTime: rich?.leadTime ?? "2–4 days",
      padsPerPack: rich?.padsPerPack ?? 0,
      length: rich?.length ?? "",
      topSheet: rich?.topSheet ?? "",
      bestFor: rich?.bestFor ?? "",
      recent: recentSet.has(p.id),
      bestSeller: p.id === bestSeller,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catalogue"
        description="Browse the ORA range, see your agreed prices, and request stock in one place."
      />
      <PartnerCatalogue products={dto} />
    </div>
  );
}
