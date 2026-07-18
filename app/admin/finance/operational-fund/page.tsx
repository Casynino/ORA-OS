import { requireRole } from "@/lib/rbac";
import { getOperationalFund } from "@/lib/services/operational-fund";
import { getSelectableAccounts } from "@/lib/services/accounts";
import { PageHeader } from "@/components/ui/page-header";
import { FinanceNav } from "@/components/admin/finance-nav";
import { OperationalFundManager } from "@/components/finance/operational-fund-manager";

export const dynamic = "force-dynamic";

/** CEO oversight of the Operational Fund — approve funding requests, and monitor
 *  the balance and every expense (with receipts). No per-expense approval. */
export default async function AdminOperationalFundPage() {
  await requireRole("ADMIN");
  const [fund, accounts] = await Promise.all([
    getOperationalFund(),
    getSelectableAccounts(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Fund"
        description="The single fund you allocate to Finance for daily operations. Approve funding requests, then monitor the balance and every recorded expense — full transparency, no per-expense sign-off."
      />
      <FinanceNav />
      <OperationalFundManager fund={fund} accounts={accounts} canApprove />
    </div>
  );
}
