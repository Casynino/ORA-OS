import { notFound } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { refreshOverdueFieldCredit } from "@/lib/services/field";
import { getFieldCustomerProfile } from "@/lib/services/customer-profile";
import { CustomerProfileView } from "@/components/customers/customer-profile-view";

export const dynamic = "force-dynamic";

export default async function RepCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireRole("SALES_REP");
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
  // A rep sees only customers they manage — never unassigned ones.
  if (!profile || profile.rep?.id !== me.id) notFound();

  return (
    <CustomerProfileView
      profile={profile}
      role="SALES_REP"
      backHref="/rep/customers"
      backLabel="All customers"
      accounts={accounts}
    />
  );
}
