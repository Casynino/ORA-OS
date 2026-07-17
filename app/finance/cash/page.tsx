import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getCashSummary } from "@/lib/services/cash";
import { PageHeader } from "@/components/ui/page-header";
import { CashDepositsManager } from "@/components/finance/cash-deposits-manager";

export const dynamic = "force-dynamic";

/** Finance's Cash on Hand & Deposits — the physical cash received from reps that
 *  hasn't been banked yet, and the tool to bank a batch of it. */
export default async function FinanceCashPage() {
  await requireRole("FINANCE");
  const [summary, accounts] = await Promise.all([
    getCashSummary(),
    prisma.paymentAccount.findMany({
      where: { isActive: true, type: { in: ["BANK", "MOBILE_MONEY"] } },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, accountNumber: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cash on hand & deposits"
        description="Physical cash you've received from reps, held until you bank it. Select collections and record one bank deposit — the cash stays tracked at every step."
      />
      <CashDepositsManager
        onHand={summary.onHand}
        items={summary.items}
        deposits={summary.deposits}
        accounts={accounts}
      />
    </div>
  );
}
