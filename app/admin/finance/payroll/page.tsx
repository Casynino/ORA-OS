import { requireRole } from "@/lib/rbac";
import { getPayrollData } from "@/lib/services/payroll-data";
import { PageHeader } from "@/components/ui/page-header";
import { FinanceNav } from "@/components/admin/finance-nav";
import { PayrollManager } from "@/components/finance/payroll-manager";

export const dynamic = "force-dynamic";

/** Payroll is the boss's own: manage the employee register and pay everyone in
 * one action on a chosen date — booked immediately as a salaries expense. */
export default async function AdminPayrollPage() {
  await requireRole("ADMIN");
  const { employees, runs, receivingAccounts } = await getPayrollData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        description="Your employees and salaries. Run payroll to pay everyone at once — it's cut from the company as a salaries expense on the pay date."
      />
      <FinanceNav />
      <PayrollManager employees={employees} runs={runs} receivingAccounts={receivingAccounts} canManage />
    </div>
  );
}
