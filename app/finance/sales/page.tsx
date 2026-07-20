import Link from "next/link";
import { ShoppingCart, TrendingUp, Banknote, CreditCard, AlertTriangle } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/admin/kpi-card";
import { SalesHistoryTable } from "@/components/admin/sales-history-table";
import { getSalesHistory } from "@/lib/services/sales-history";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Finance's sales-tracking view — every sale across all channels (rep field sales,
// office/direct sales, partner orders) with its payment + confirmation status, so
// Finance can follow the money without depending on anyone else.
export default async function FinanceSalesPage() {
  await requireRole("FINANCE");
  const rows = await getSalesHistory();

  const confirmed = rows.filter((r) => r.confirmed);
  const revenue = confirmed.reduce((s, r) => s + r.total, 0);
  const creditTotal = confirmed.filter((r) => r.paymentType === "CREDIT").reduce((s, r) => s + r.total, 0);
  const pending = rows.filter((r) => r.status === "Awaiting confirmation").length;
  // Owed on CONFIRMED credit only — reconciles with credit sales (owed ≤ sold).
  const outstanding = confirmed.filter((r) => r.paymentType === "CREDIT").reduce((s, r) => s + r.balance, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales history"
        description="Every sale across all channels — track payments, confirmations and credit collections. Who sold what, to whom, and whether the money is in."
      >
        <Link href="/finance/sell" className={cn(buttonVariants({ size: "sm" }), "rounded-full")}>
          <ShoppingCart className="mr-1.5 size-4" /> Record sale
        </Link>
      </PageHeader>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Total sales" value={rows.length} icon={ShoppingCart} accent="primary" />
        <KpiCard label="Revenue (confirmed)" value={revenue} prefix="TSh " icon={TrendingUp} accent="success" />
        <KpiCard label="Awaiting confirmation" value={pending} icon={AlertTriangle} accent={pending > 0 ? "warning" : "success"} />
        <KpiCard label="Credit sales" value={creditTotal} prefix="TSh " icon={CreditCard} accent="accent" />
        <KpiCard label="Outstanding credit" value={outstanding} prefix="TSh " icon={Banknote} accent={outstanding > 0 ? "warning" : "success"} />
      </div>

      <SalesHistoryTable rows={rows} />
    </div>
  );
}
