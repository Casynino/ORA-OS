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

// A rep's own sales history — every sale they've recorded, with its confirmation
// and credit status, scoped to their book (getSalesHistory excludes partner
// orders and other reps when repId is passed).
export default async function RepSalesHistoryPage() {
  const me = await requireRole("SALES_REP");
  const rows = await getSalesHistory({ repId: me.id });

  const confirmed = rows.filter((r) => r.confirmed);
  const cashTotal = confirmed.filter((r) => r.paymentType === "CASH").reduce((s, r) => s + r.total, 0);
  const creditTotal = confirmed.filter((r) => r.paymentType === "CREDIT").reduce((s, r) => s + r.total, 0);
  const pending = rows.filter((r) => r.status === "Awaiting confirmation").length;

  return (
    <div className="space-y-6">
      <PageHeader title="My sales history" description="Every sale you've recorded — cash and credit, confirmed and pending.">
        <Link href="/rep/sell" className={cn(buttonVariants({ size: "sm" }), "rounded-full")}>
          <ShoppingCart className="mr-1.5 size-4" /> Record sale
        </Link>
      </PageHeader>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <KpiCard label="My sales" value={rows.length} icon={ShoppingCart} accent="primary" />
        <KpiCard label="Confirmed value" value={confirmed.reduce((s, r) => s + r.total, 0)} prefix="TSh " icon={TrendingUp} accent="success" />
        <KpiCard label="Cash sales" value={cashTotal} prefix="TSh " icon={Banknote} accent="success" />
        <KpiCard label="Credit sales" value={creditTotal} prefix="TSh " icon={CreditCard} accent="accent" />
        <KpiCard label="Awaiting finance" value={pending} icon={AlertTriangle} accent={pending > 0 ? "warning" : "success"} />
      </div>

      <SalesHistoryTable rows={rows} />
    </div>
  );
}
