import { requireRole } from "@/lib/rbac";
import { getCreditWorkspaceData } from "@/lib/services/credit-page-data";
import { PageHeader } from "@/components/ui/page-header";
import { CreditLedger } from "@/components/admin/credit-ledger";

export const dynamic = "force-dynamic";

/** Finance owns accounts receivable — the same live credit ledger the admin
 * sees, with full settlement and repayment powers. */
export default async function FinanceCreditPage() {
  await requireRole("FINANCE");
  const { creditAccounts, settlements, fieldCredits, paymentAccounts } =
    await getCreditWorkspaceData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credit & Settlements"
        description="Accounts receivable, live — every credit in the company (partners AND rep customers), every repayment, every overdue risk."
      />
      <CreditLedger
        accounts={creditAccounts}
        settlements={settlements}
        fieldCredits={fieldCredits}
        paymentAccounts={paymentAccounts}
        detailBase="/finance/credit"
        fieldCustomerBase=""
      />
    </div>
  );
}
