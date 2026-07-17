import { notFound } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { refreshOverdueFieldCredit } from "@/lib/services/field";
import { getFieldCustomerProfile } from "@/lib/services/customer-profile";
import { CustomerProfileView } from "@/components/customers/customer-profile-view";

export const dynamic = "force-dynamic";

export default async function FinanceCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("FINANCE");
  const { id } = await params;
  await refreshOverdueFieldCredit();

  const [profile, accounts] = await Promise.all([
    getFieldCustomerProfile(id),
    prisma.paymentAccount.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, accountName: true, accountNumber: true },
    }),
  ]);
  if (!profile) notFound();

  return (
    <CustomerProfileView
      profile={profile}
      role="FINANCE"
      backHref="/finance/customers"
      backLabel="All customers"
      accounts={accounts}
    />
  );
}
