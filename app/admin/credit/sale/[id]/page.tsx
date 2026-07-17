import { notFound } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { getCreditSaleDetail } from "@/lib/services/credit-sale-detail";
import { CreditSaleDetail } from "@/components/finance/credit-sale-detail";

export const dynamic = "force-dynamic";

export default async function AdminDebtDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");
  const { id } = await params;
  const { sale, accounts } = await getCreditSaleDetail(id);
  if (!sale) notFound();
  return <CreditSaleDetail sale={sale} accounts={accounts} backHref="/admin/credit" />;
}
