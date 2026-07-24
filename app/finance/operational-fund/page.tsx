import { requireRole } from "@/lib/rbac";
import { getOperationalFund } from "@/lib/services/operational-fund";
import { getSelectableCategories } from "@/lib/services/categories";
import { getExpenseClaims } from "@/lib/services/expense-claims";
import { PageHeader } from "@/components/ui/page-header";
import { OperationalFundManager } from "@/components/finance/operational-fund-manager";

export const dynamic = "force-dynamic";

/** Finance's single operational spending module. Request funds from the CEO,
 *  spend from the allocated balance, record already-paid expenses for the CEO to
 *  approve & allocate, and see every use — one place. */
export default async function FinanceOperationalFundPage() {
  await requireRole("FINANCE");
  const [fund, categories, claims] = await Promise.all([
    getOperationalFund(),
    getSelectableCategories("operational"),
    getExpenseClaims(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Fund"
        description="Funds allocated to Finance for day-to-day operations. Request funds, spend from the balance, and record every expense with receipts — all in one place."
      />
      <OperationalFundManager fund={fund} categories={categories} claims={claims} canManage />
    </div>
  );
}
