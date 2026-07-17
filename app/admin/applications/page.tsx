import { PageHeader } from "@/components/ui/page-header";
import { ApplicationsList } from "@/components/admin/applications-list";
import { getPendingApplications } from "@/lib/services/application-detail";

export default async function AdminApplicationsPage() {
  const apps = await getPendingApplications();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Partner applications"
        description="Open each application to review the business, set prices & terms, then approve or reject."
      />
      <ApplicationsList apps={apps} basePath="/admin/applications" />
    </div>
  );
}
