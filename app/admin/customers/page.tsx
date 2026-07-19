import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { MasterCustomersTables } from "@/components/admin/master-customers-tables";
import { CustomerIntelligencePanel } from "@/components/admin/command-sections";
import { getMasterCustomers } from "@/lib/services/master-customers";
import { getCustomerIntelligence } from "@/lib/services/intelligence";

export const dynamic = "force-dynamic";

/** The company's master customer database: partners AND rep-acquired field
 *  customers. Reps manage the relationship; ORA owns the customer. The CEO's
 *  customer intelligence (by type, top customers) lives here — the dashboard
 *  keeps only a compact strip and links through. */
export default async function AdminCustomersPage() {
  const [{ partners, fieldCustomers }, intelligence] = await Promise.all([
    getMasterCustomers(),
    getCustomerIntelligence(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Customers"
        description="ORA's master customer database — partners and field customers acquired by the sales team, in one place. Register new customers or onboard existing ones with their opening balances."
      >
        <Link
          href="/admin/reps/customers/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          + Register customer
        </Link>
      </PageHeader>
      <CustomerIntelligencePanel cust={intelligence} />
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
