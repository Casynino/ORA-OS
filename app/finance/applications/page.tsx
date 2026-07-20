import { requireRole } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { ApplicationsList } from "@/components/admin/applications-list";
import { getPendingApplications } from "@/lib/services/application-detail";

export const dynamic = "force-dynamic";

export default async function FinanceApplicationsPage() {
  await requireRole("FINANCE");
  const apps = await getPendingApplications();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Partner applications"
        description="Verify the business, set credit eligibility, limit, pricing and financial notes, then approve — every decision is recorded."
      />
      <ApplicationsList apps={apps} basePath="/finance/applications" />
    </div>
  );
}
