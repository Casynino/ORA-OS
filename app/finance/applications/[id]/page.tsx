import { notFound } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { getApplicationDTO } from "@/lib/services/application-detail";
import { ApplicationReview } from "@/components/admin/application-review";

export const dynamic = "force-dynamic";

export default async function FinanceApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("FINANCE");
  const { id } = await params;
  const dto = await getApplicationDTO(id);
  if (!dto) notFound();
  return (
    <ApplicationReview key={dto.status} app={dto} basePath="/finance/applications" />
  );
}
