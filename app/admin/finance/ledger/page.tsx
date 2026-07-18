import { requireRole } from "@/lib/rbac";
import { getLedger } from "@/lib/services/finance";
import { PageHeader } from "@/components/ui/page-header";
import { FinanceNav } from "@/components/admin/finance-nav";
import { GeneralLedgerTable } from "@/components/admin/general-ledger-table";

export const dynamic = "force-dynamic";

export default async function AdminGeneralLedgerPage() {
  await requireRole("ADMIN");
  // The General Ledger is ORA's full accounting register — load the whole history
  // (high cap) and let the client filter/search/sort/export against it, so the
  // running balance and totals are computed over every real movement.
  const rows = await getLedger("all", 1000);

  return (
    <div className="space-y-6">
      <PageHeader
        title="General Ledger"
        description="Every money movement in ORA — sales, collections, expenses and capital — with its account, who recorded it and a running balance. Search, filter, sort and export."
      />
      <FinanceNav />
      <GeneralLedgerTable rows={rows} />
    </div>
  );
}
