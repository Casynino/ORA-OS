import { PageHeader } from "@/components/ui/page-header";
import { MasterCustomersTables } from "@/components/admin/master-customers-tables";
import { getMasterCustomers } from "@/lib/services/master-customers";

export const dynamic = "force-dynamic";

/** The company's master customer database: partners AND rep-acquired field
 *  customers. Reps manage the relationship; ORA owns the customer. */
export default async function AdminCustomersPage() {
  const { partners, fieldCustomers } = await getMasterCustomers();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Customers"
        description="ORA's master customer database — partners and field customers acquired by the sales team, in one place."
      />
      <MasterCustomersTables
        partners={partners}
        fieldCustomers={fieldCustomers}
        partnerHref={(id) => `/admin/customers/${id}`}
        fieldHref={(id) => `/admin/reps/customers/${id}`}
        repHref={(id) => `/admin/reps/${id}`}
      />
    </div>
  );
}
