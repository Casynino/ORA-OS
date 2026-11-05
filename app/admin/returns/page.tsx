import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { ReturnsManager } from "@/components/admin/returns-manager";
import { CUSTOMER_RETURN_TYPE, isRepStockReturn } from "@/lib/rep-returns";

export default async function AdminReturnsPage() {
  const [returns, partnerPrices] = await Promise.all([
    prisma.returnRequest.findMany({
      // Customer returns never touch a warehouse (the goods go back to the rep) —
      // Finance tracks those on its own Returns page.
      where: { OR: [{ reasonType: null }, { reasonType: { not: CUSTOMER_RETURN_TYPE } }] },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        product: { select: { name: true, price: true, unitsPerCarton: true, notForSale: true } },
        requester: { select: { name: true } },
      },
    }),
    prisma.partnerPrice.findMany(),
  ]);

  const priceMap = new Map(
    partnerPrices.map((p) => [`${p.partnerId}:${p.productId}`, p.price]),
  );

  const dto = returns.map((r) => {
    const unit =
      priceMap.get(`${r.requesterId}:${r.productId}`) ?? r.product.price;
    return {
      id: r.id,
      code: r.code,
      productName: r.product.name,
      requesterName: r.requester.name,
      quantity: r.quantity,
      reasonType: r.reasonType,
      reason: r.reason,
      warehouseName: r.warehouseName,
      value: r.quantity * unit,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      isRepStock: isRepStockReturn(r),
      unitsPerCarton: r.product.unitsPerCarton,
      notForSale: r.product.notForSale,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Returns"
        description="Authorise returns, confirm warehouse receipt to reconcile stock, or reject them. Every decision is logged."
      />
      <ReturnsManager returns={dto} detailBase="/admin/returns" />
    </div>
  );
}
