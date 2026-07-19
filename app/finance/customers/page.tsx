import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { MasterCustomersTables } from "@/components/admin/master-customers-tables";
import { getMasterCustomers } from "@/lib/services/master-customers";

export const dynamic = "force-dynamic";

/** Finance's view of ORA's master customer database — every partner and every
 *  rep-acquired field customer. Finance sees all; reps see only their own. */
export default async function FinanceCustomersPage() {
  await requireRole("FINANCE");
  const { partners, fieldCustomers } = await getMasterCustomers();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Customer database"
        description="Every ORA customer in one place — partners and field customers. The customer belongs to ORA; a rep manages the relationship. Register new customers here."
      >
        <Link
          href="/finance/customers/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          + Register customer
        </Link>
      </PageHeader>
      <MasterCustomersTables
        partners={partners}
        fieldCustomers={fieldCustomers}
        partnerHref={() => "/finance/partners"}
        fieldHref={(id) => `/finance/customers/${id}`}
      />
    </div>
  );
}
