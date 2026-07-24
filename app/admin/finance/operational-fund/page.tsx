import { requireRole } from "@/lib/rbac";
import { getOperationalFund, getSpendSummary } from "@/lib/services/operational-fund";
import { getSelectableAccounts } from "@/lib/services/accounts";
import { getSelectableCategories } from "@/lib/services/categories";
import { getExpenseClaims } from "@/lib/services/expense-claims";
import { PageHeader } from "@/components/ui/page-header";
import { FinanceNav } from "@/components/admin/finance-nav";
import { OperationalFundManager } from "@/components/finance/operational-fund-manager";

export const dynamic = "force-dynamic";

/** CEO oversight of the Operational Fund — approve funding requests, review &
 *  allocate Finance's recorded expenses, and monitor the balance. */
export default async function AdminOperationalFundPage() {
  await requireRole("ADMIN");
  const [fund, spend, accounts, categories, claims] = await Promise.all([
    getOperationalFund(),
    getSpendSummary(),
    getSelectableAccounts(),
    getSelectableCategories("operational"),
    getExpenseClaims(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Fund"
        description="The single fund you allocate to Finance for daily operations. Approve funding requests, then monitor the balance and every recorded expense — full transparency, no per-expense sign-off."
      />
      <FinanceNav />
      <OperationalFundManager fund={fund} spend={spend} accounts={accounts} categories={categories} claims={claims} canApprove />
    </div>
  );
}
