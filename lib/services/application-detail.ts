import { prisma } from "@/lib/db";
import type { AppDTO } from "@/components/admin/application-review";

/** Shared assembly for the admin + finance partner-application review pages. */
export async function getApplicationDTO(id: string): Promise<AppDTO | null> {
  const [user, products] = await Promise.all([
    prisma.user.findUnique({ where: { id } }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { price: "desc" },
      select: { id: true, name: true, sku: true, price: true },
    }),
  ]);
  if (!user || user.role !== "PARTNER") return null;

  return {
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
    financeNotes: user.financeNotes,
    applicationNote: user.applicationNote,
    appliedAt: user.createdAt.toISOString(),
    products: products.map((p) => ({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      price: p.price,
    })),
  };
}

/** Pending partner applications, newest first — shared list source. */
export async function getPendingApplications() {
  return prisma.user.findMany({
    where: { role: "PARTNER", status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
}
