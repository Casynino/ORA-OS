import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { UsersManager } from "@/components/admin/users-manager";

export default async function AdminUsersPage() {
  const [users, products, partnerPrices, warehouses] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { price: "desc" },
      select: { id: true, name: true, sku: true, price: true },
    }),
    prisma.partnerPrice.findMany(),
    prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const pricesByPartner = new Map<string, Record<string, number>>();
  for (const pp of partnerPrices) {
    const m = pricesByPartner.get(pp.partnerId) ?? {};
    m[pp.productId] = pp.price;
    pricesByPartner.set(pp.partnerId, m);
  }

  const dto = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    organization: u.organization,
    location: u.location,
    creditLimit: u.creditLimit,
    prices: pricesByPartner.get(u.id) ?? {},
    canRecordSales: u.canRecordSales,
    canCreateTransfers: u.canCreateTransfers,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & partners"
        description="Approve partners, manage access, and set each partner's prices & credit."
      />
      <UsersManager users={dto} products={products} warehouses={warehouses} />
    </div>
  );
}
