import { notFound } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { refreshOverdueFieldCredit } from "@/lib/services/field";
import { getFieldCustomerProfile } from "@/lib/services/customer-profile";
import { CustomerProfileView } from "@/components/customers/customer-profile-view";

export const dynamic = "force-dynamic";

export default async function AdminFieldCustomerPage({
  params,
}: {
  params: Promise<{ cid: string }>;
}) {
  await requireRole("ADMIN");
  const { cid } = await params;
  await refreshOverdueFieldCredit();

  const [profile, accounts] = await Promise.all([
    getFieldCustomerProfile(cid),
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
      role="ADMIN"
      backHref="/admin/reps/customers"
      backLabel="All field customers"
      accounts={accounts}
      repHref={`/admin/reps/${profile.rep.id}`}
    />
  );
}
