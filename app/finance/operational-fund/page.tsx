import { requireRole } from "@/lib/rbac";
import { getOperationalFund } from "@/lib/services/operational-fund";
import { PageHeader } from "@/components/ui/page-header";
import { OperationalFundManager } from "@/components/finance/operational-fund-manager";

export const dynamic = "force-dynamic";

/** Finance's single operational spending module. Request funds from the CEO,
 *  spend from the allocated balance, and record every use — one place. */
export default async function FinanceOperationalFundPage() {
  await requireRole("FINANCE");
  const fund = await getOperationalFund();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Fund"
        description="Money the CEO allocates to Finance for day-to-day operations. Request funds, spend from the balance, and record every expense with receipts — all in one place."
      />
      <OperationalFundManager fund={fund} canManage />
    </div>
  );
}
