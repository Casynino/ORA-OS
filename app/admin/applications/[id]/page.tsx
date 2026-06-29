import { notFound } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import {
  ApplicationReview,
  type AppDTO,
} from "@/components/admin/application-review";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");
  const { id } = await params;

  const [user, products] = await Promise.all([
    prisma.user.findUnique({ where: { id } }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { price: "desc" },
      select: { id: true, name: true, sku: true, price: true },
    }),
  ]);
  if (!user || user.role !== "PARTNER") notFound();

  const dto: AppDTO = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    organization: user.organization,
    location: user.location,
    status: user.status,
    businessType: user.businessType,
    region: user.region,
    district: user.district,
    street: user.street,
    expectedVolume: user.expectedVolume,
    preferredPayment: user.preferredPayment,
    businessLicense: user.businessLicense,
    taxId: user.taxId,
    creditLimit: user.creditLimit,
    paymentTerms: user.paymentTerms,
    applicationNote: user.applicationNote,
    appliedAt: user.createdAt.toISOString(),
    products: products.map((p) => ({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      price: p.price,
    })),
  };

  return <ApplicationReview key={user.status} app={dto} />;
}
