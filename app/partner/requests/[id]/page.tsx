import { notFound } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import {
  PartnerOrderDetail,
  type POrderDTO,
} from "@/components/dashboard/partner-order-detail";

export default async function PartnerOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("PARTNER");
  const { id } = await params;

  const r = await prisma.request.findUnique({
    where: { id },
    include: {
      items: { include: { product: true } },
      reviewedBy: { select: { name: true } },
    },
  });
  if (!r || r.requesterId !== user.id) notFound();

  const [warehouses, partnerPrices, products] = await Promise.all([
    prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, location: true },
    }),
    prisma.partnerPrice.findMany({ where: { partnerId: user.id } }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { price: "desc" },
      select: { id: true, name: true, sku: true, price: true },
    }),
  ]);

  const ppMap = new Map(partnerPrices.map((p) => [p.productId, p.price]));

  const dto: POrderDTO = {
    id: r.id,
    code: r.code,
    status: r.status,
    paymentType: r.paymentType,
    paymentStatus: r.paymentStatus,
    invoiceNo: r.invoiceNo,
    totalAmount: r.totalAmount,
    note: r.note,
    adminNote: r.adminNote,
    deliverTo: r.deliverTo,
    deliverBy: r.deliverBy ? r.deliverBy.toISOString() : null,
    warehouseName: r.warehouseName,
    reviewedByName: r.reviewedBy?.name ?? null,
    createdAt: r.createdAt.toISOString(),
    items: r.items.map((i) => ({
      productId: i.productId,
      name: i.product.name,
      sku: i.product.sku,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
    catalog: products.map((p) => ({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      price: ppMap.get(p.id) ?? p.price,
    })),
    warehouses,
  };

  return <PartnerOrderDetail key={r.status} order={dto} />;
}
