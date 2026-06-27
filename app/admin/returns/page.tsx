import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { ReturnsManager } from "@/components/admin/returns-manager";

export default async function AdminReturnsPage() {
  const [returns, partnerPrices] = await Promise.all([
    prisma.returnRequest.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        product: { select: { name: true, price: true } },
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
