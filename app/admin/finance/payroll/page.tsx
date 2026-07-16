import { requireRole } from "@/lib/rbac";
import { getPayrollData } from "@/lib/services/payroll-data";
import { PageHeader } from "@/components/ui/page-header";
import { FinanceNav } from "@/components/admin/finance-nav";
import { PayrollManager } from "@/components/finance/payroll-manager";

export const dynamic = "force-dynamic";

/** Admin vantage point: approve or reject payroll runs before payment. */
export default async function AdminPayrollPage() {
  await requireRole("ADMIN");
  const { employees, runs, receivingAccounts } = await getPayrollData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        description="Where ORA money comes from and where it goes — live, categorised, traceable."
      >
        <FinanceNav />
      </PageHeader>
      <PayrollManager employees={employees} runs={runs} receivingAccounts={receivingAccounts} mode="admin" />
    </div>
  );
}
