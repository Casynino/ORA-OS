import { CreditCard, Users, AlertTriangle } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { refreshOverdueFieldCredit } from "@/lib/services/field";
import { getFieldCustomerRows } from "@/lib/services/customer-profile";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { NewCustomerForm } from "@/components/field/field-forms";
import { CustomersList } from "@/components/customers/customers-list";
import { formatCurrency, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RepCustomersPage() {
  const me = await requireRole("SALES_REP");
  await refreshOverdueFieldCredit();
  const rows = await getFieldCustomerRows({ repId: me.id });

  const totalOwed = rows.reduce((s, r) => s + r.outstanding, 0);
  const debtors = rows.filter((r) => r.outstanding > 0).length;
  const overdueCount = rows.filter((r) => r.overdue).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My customers"
        description="Your customer database — who owes what, their credit, and their full history."
      >
        <NewCustomerForm />
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Customers" value={formatNumber(rows.length)} icon={Users} accent="primary" />
        <StatCard
          label="Outstanding credit"
          value={formatCurrency(totalOwed)}
          icon={CreditCard}
          accent="warning"
          hint={`${debtors} with balances`}
        />
        <StatCard
          label="Overdue"
          value={formatNumber(overdueCount)}
          icon={AlertTriangle}
          accent={overdueCount > 0 ? "warning" : "success"}
        />
      </div>

      <CustomersList rows={rows} basePath="/rep/customers" />
    </div>
  );
}
