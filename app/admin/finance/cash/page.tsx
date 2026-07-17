import { requireRole } from "@/lib/rbac";
import { getCashSummary } from "@/lib/services/cash";
import { PageHeader } from "@/components/ui/page-header";
import { FinanceNav } from "@/components/admin/finance-nav";
import { CashDepositsManager } from "@/components/finance/cash-deposits-manager";

export const dynamic = "force-dynamic";

/** CEO's read-only view of cash: what's collected, what's waiting to be banked,
 *  and the full bank-deposit history with the exact collections each covered. */
export default async function AdminCashPage() {
  await requireRole("ADMIN");
  const summary = await getCashSummary();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cash & deposits"
        description="Monitor cash across its whole life — collected from reps, held on hand, and banked. Open any deposit to see exactly which cash sales it covered."
      >
        <FinanceNav />
      </PageHeader>
      <CashDepositsManager
        onHand={summary.onHand}
        items={summary.items}
        deposits={summary.deposits}
        accounts={[]}
        readOnly
      />
    </div>
  );
}
