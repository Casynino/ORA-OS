import { requireRole } from "@/lib/rbac";
import { getPettyCashData } from "@/lib/services/petty-cash-data";
import { PageHeader } from "@/components/ui/page-header";
import { FinanceNav } from "@/components/admin/finance-nav";
import { PettyCashManager } from "@/components/finance/petty-cash-manager";

export const dynamic = "force-dynamic";

/** Admin vantage point: approve or reject finance's petty cash requests. */
export default async function AdminPettyCashPage() {
  await requireRole("ADMIN");
  const { requests, receivingAccounts } = await getPettyCashData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        description="Where ORA money comes from and where it goes — live, categorised, traceable."
      >
        <FinanceNav />
      </PageHeader>
      <PettyCashManager requests={requests} receivingAccounts={receivingAccounts} mode="admin" />
    </div>
  );
}
