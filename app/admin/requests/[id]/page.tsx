import { notFound } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import {
  AdminRequestDetail,
  type DetailDTO,
} from "@/components/admin/admin-request-detail";

export default async function AdminRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");
  const { id } = await params;

  const r = await prisma.request.findUnique({
    where: { id },
    include: {
      requester: {
        select: {
          name: true,
          organization: true,
          role: true,
          status: true,
          location: true,
          email: true,
          phone: true,
          creditLimit: true,
          createdAt: true,
        },
      },
      items: { include: { product: true } },
      reviewedBy: { select: { name: true } },
    },
  });
  if (!r) notFound();

  const [credits, products, partnerPrices] = await Promise.all([
    prisma.creditAccount.aggregate({
      where: { agentId: r.requesterId, status: { not: "SETTLED" } },
      _sum: { principal: true, amountPaid: true },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { price: "desc" },
      select: { id: true, name: true, sku: true, price: true },
    }),
    prisma.partnerPrice.findMany({ where: { partnerId: r.requesterId } }),
  ]);

  const outstanding =
    (credits._sum.principal ?? 0) - (credits._sum.amountPaid ?? 0);
  const creditLimit = r.requester.creditLimit ?? 0;
  const ppMap = new Map(partnerPrices.map((p) => [p.productId, p.price]));

  const dto: DetailDTO = {
    id: r.id,
    code: r.code,
    type: r.type,
    status: r.status,
    paymentType: r.paymentType,
    paymentStatus: r.paymentStatus,
    paymentClaimedAt: r.paymentClaimedAt ? r.paymentClaimedAt.toISOString() : null,
    invoiceNo: r.invoiceNo,
    deliveredAt: r.deliveredAt ? r.deliveredAt.toISOString() : null,
    discount: r.discount,
    deliveryCharge: r.deliveryCharge,
    createdAt: r.createdAt.toISOString(),
    note: r.note,
    adminNote: r.adminNote,
    deliverTo: r.deliverTo,
    deliveryAddress: r.deliveryAddress,
    contactName: r.contactName,
    contactPhone: r.contactPhone,
    deliverBy: r.deliverBy ? r.deliverBy.toISOString() : null,
    warehouseName: r.warehouseName,
    reviewedByName: r.reviewedBy?.name ?? null,
    totalAmount: r.totalAmount,
    items: r.items.map((i) => ({
      id: i.id,
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
    partner: {
      name: r.requester.name,
      org: r.requester.organization,
      role: r.requester.role,
      status: r.requester.status,
      location: r.requester.location,
      email: r.requester.email,
      phone: r.requester.phone,
      memberSince: r.requester.createdAt.toISOString(),
      creditLimit,
      outstanding,
      available: Math.max(0, creditLimit - outstanding),
    },
  };

  return (
    <AdminRequestDetail
      key={`${r.status}-${r.totalAmount ?? "x"}-${r.items.length}`}
      request={dto}
    />
  );
}
