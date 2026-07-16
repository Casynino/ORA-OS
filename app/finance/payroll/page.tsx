import { Users, Banknote, Clock } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { getPayrollData } from "@/lib/services/payroll-data";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { PayrollManager } from "@/components/finance/payroll-manager";
import { formatCurrency, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FinancePayrollPage() {
  await requireRole("FINANCE");
  const { employees, runs, receivingAccounts } = await getPayrollData();

  const active = employees.filter((e) => e.isActive);
  const salaryBill = active.reduce((s, e) => s + e.baseSalary, 0);
  const awaiting = runs.filter((r) => r.status === "PENDING_APPROVAL").length;
  const readyToPay = runs.filter((r) => r.status === "APPROVED");
  const readyValue = readyToPay.reduce(
    (s, r) => s + r.items.reduce((x, i) => x + i.net, 0),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        description="Employee register, monthly runs and salary history — the admin approves each run before it's paid."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active employees" value={formatNumber(active.length)} hint={`${formatCurrency(salaryBill)} monthly bill`} icon={Users} accent="primary" />
        <StatCard label="Awaiting admin approval" value={formatNumber(awaiting)} icon={Clock} accent={awaiting > 0 ? "warning" : "success"} />
        <StatCard label="Ready to pay" value={formatNumber(readyToPay.length)} hint={formatCurrency(readyValue)} icon={Banknote} accent={readyToPay.length > 0 ? "info" : "success"} />
      </div>
      <PayrollManager employees={employees} runs={runs} receivingAccounts={receivingAccounts} mode="finance" />
    </div>
  );
}
