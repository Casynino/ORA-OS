import { Wallet, Clock, CalendarClock } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { getPettyCashData } from "@/lib/services/petty-cash-data";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { PettyCashManager } from "@/components/finance/petty-cash-manager";
import { formatCurrency, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FinanceOfficeFundPage() {
  await requireRole("FINANCE");
  const { requests, receivingAccounts } = await getPettyCashData();

  const open = requests.filter((r) => r.status === "APPROVED");
  const pending = requests.filter((r) => r.status === "PENDING");
  // Fund balance = unspent money across every open (CEO-approved) allocation.
  const fundBalance = open.reduce((s, r) => s + r.remaining, 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const spentThisMonth = requests
    .flatMap((r) => r.expenses)
    .filter((e) => new Date(e.createdAt) >= monthStart)
    .reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Office expense fund"
        description="Request funds from the CEO, then spend from the approved fund on day-to-day office costs — every expense appears on the CEO dashboard instantly."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Fund balance"
          value={formatCurrency(fundBalance)}
          hint={`${open.length} open allocation${open.length === 1 ? "" : "s"}`}
          icon={Wallet}
          accent={fundBalance > 0 ? "success" : "info"}
        />
        <StatCard
          label="Awaiting CEO approval"
          value={formatNumber(pending.length)}
          hint={formatCurrency(pending.reduce((s, r) => s + r.amount, 0))}
          icon={Clock}
          accent={pending.length > 0 ? "warning" : "success"}
        />
        <StatCard label="Spent this month" value={formatCurrency(spentThisMonth)} icon={CalendarClock} accent="primary" />
      </div>
      <PettyCashManager requests={requests} receivingAccounts={receivingAccounts} mode="finance" />
    </div>
  );
}
