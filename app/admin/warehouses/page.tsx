import Link from "next/link";
import {
  Warehouse as WIcon,
  Package,
  Users,
  MapPin,
  ArrowLeftRight,
  ClipboardList,
  Undo2,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/admin/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { NewWarehouseButton } from "@/components/admin/warehouse-forms";
import { getWarehouseSummaries, getStockMatrix } from "@/lib/warehouse-data";
import { formatNumber } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "success" | "secondary" | "warning"> = {
  ACTIVE: "success",
  OFFLINE: "secondary",
  MAINTENANCE: "warning",
};

export default async function AdminWarehousesPage() {
  const [summaries, matrix] = await Promise.all([
    getWarehouseSummaries(),
    getStockMatrix(),
  ]);
  const totalStock = summaries.reduce((s, w) => s + w.onHand, 0);
  const totalStaff = summaries.reduce((s, w) => s + w.staffCount, 0);
  const inTransit = summaries.reduce((s, w) => s + w.inTransit, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouses"
        description="Network-wide stock, staff and activity across every ORA warehouse. Open one for the full profile."
      >
        <NewWarehouseButton />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Warehouses" value={summaries.length} icon={WIcon} accent="primary" />
        <KpiCard label="Stock on hand" value={totalStock} suffix=" units" icon={Package} accent="success" />
        <KpiCard label="In transit" value={inTransit} suffix=" units" icon={ArrowLeftRight} accent="info" />
        <KpiCard label="Warehouse staff" value={totalStaff} icon={Users} accent="info" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {summaries.map((w) => (
          <Link
            key={w.id}
            href={`/admin/warehouses/${w.id}`}
            className="glass-card group rounded-2xl p-6 transition hover:-translate-y-0.5 hover:shadow-glow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white">
                  <WIcon className="size-5" />
                </span>
                <div>
                  <h3 className="font-display font-semibold">{w.name}</h3>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" />
                    {w.location ?? "—"}
                    {w.manager ? ` · Manager: ${w.manager}` : " · No manager"}
                  </p>
                </div>
              </div>
              <Badge variant={STATUS_VARIANT[w.status] ?? "secondary"}>
                {w.status.charAt(0) + w.status.slice(1).toLowerCase()}
              </Badge>
            </div>

            {/* Capacity */}
            <div className="mt-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Stock on hand</span>
                <span className="font-medium">
                  {formatNumber(w.onHand)}
                  {w.capacity ? ` / ${formatNumber(w.capacity)}` : ""}
                </span>
              </div>
              <Progress value={w.capacityPct} className="mt-2" />
              <p className="mt-1 text-xs text-muted-foreground">
                {w.capacity ? `${w.capacityPct}% of capacity · ` : ""}
                {w.products} product{w.products === 1 ? "" : "s"}
                {w.lowStock > 0 && (
                  <span className="ml-1 inline-flex items-center gap-0.5 text-warning">
                    <AlertTriangle className="size-3" />
                    {w.lowStock} low
                  </span>
                )}
              </p>
            </div>

            {/* Metrics */}
            <div className="mt-5 grid grid-cols-4 gap-2 border-t border-border pt-4 text-center">
              <Metric icon={ClipboardList} label="Orders" value={w.activeOrders} />
              <Metric icon={ArrowLeftRight} label="In" value={w.transfersIn} />
              <Metric icon={ArrowLeftRight} label="Out" value={w.transfersOut} />
              <Metric icon={Undo2} label="Returns" value={w.pendingReturns} />
            </div>

            <p className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition group-hover:opacity-100">
              Open warehouse <ChevronRight className="size-4" />
            </p>
          </Link>
        ))}
      </div>

      {/* Global stock distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Stock distribution</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  {matrix.warehouses.map((w) => (
                    <TableHead key={w.id} className="text-right">
                      {w.name}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Network</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matrix.rows.map((r) => (
                  <TableRow key={r.productId}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    {matrix.warehouses.map((w) => {
                      const c = r.cells[w.id];
                      return (
                        <TableCell key={w.id} className="text-right">
                          <span className={c?.low ? "font-medium text-warning" : ""}>
                            {formatNumber(c?.onHand ?? 0)}
                          </span>
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right font-semibold">
                      {formatNumber(r.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Rebalancing suggestions */}
      <Card>
        <CardHeader>
          <CardTitle>Rebalancing suggestions</CardTitle>
        </CardHeader>
        <CardContent>
          {matrix.recommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Stock is balanced — every warehouse is above its minimum levels.
            </p>
          ) : (
            <ul className="space-y-2">
              {matrix.recommendations.map((rec, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
                >
                  <span>
                    Move{" "}
                    <span className="font-semibold">
                      {formatNumber(rec.quantity)} {rec.product}
                    </span>{" "}
                    from <span className="font-medium">{rec.from}</span> →{" "}
                    <span className="font-medium">{rec.to}</span>
                  </span>
                  <Link
                    href="/admin/transfers"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Create transfer →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div>
      <Icon className="mx-auto size-4 text-muted-foreground" />
      <p className="mt-1 font-display text-lg font-semibold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
