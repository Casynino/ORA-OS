import Link from "next/link";
import { Store, Map, MapPin, ExternalLink } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StockistsManager, type StockistRow } from "@/components/admin/stockists-manager";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminStockistsPage() {
  await requireRole("ADMIN");

  const rows = await prisma.stockist.findMany({
    orderBy: [{ region: "asc" }, { district: "asc" }, { name: "asc" }],
  });

  const active = rows.filter((r) => r.isActive);
  const regions = new Set(active.map((r) => r.region.trim().toLowerCase())).size;
  const districts = new Set(
    active.map((r) => `${r.region}·${r.district}`.toLowerCase()),
  ).size;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stockists & coverage"
        description="The outlets on the public Find ORA map — every change goes live instantly."
      >
        <Link
          href="/find-ora"
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          View public map
          <ExternalLink className="size-3.5" />
        </Link>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active stockists" value={formatNumber(active.length)} icon={Store} accent="primary" hint={rows.length !== active.length ? `${rows.length - active.length} hidden` : undefined} />
        <StatCard label="Regions covered" value={formatNumber(regions)} icon={Map} accent="accent" />
        <StatCard label="Districts reached" value={formatNumber(districts)} icon={MapPin} accent="success" />
      </div>

      <StockistsManager rows={rows as StockistRow[]} />
    </div>
  );
}
