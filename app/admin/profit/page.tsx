import Link from "next/link";
import { TrendingUp, Package, Wallet, Percent } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/admin/kpi-card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
];

export default async function AdminProfitPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period = "month" } = await searchParams;
  const now = new Date();
  let since: Date | null = null;
  if (period === "today") {
    since = new Date(now);
    since.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    since = new Date(now.getTime() - 7 * 86400000);
  } else if (period === "month") {
    since = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const [fulfilled, inventories] = await Promise.all([
    prisma.request.findMany({
      where: {
        status: "FULFILLED",
        ...(since ? { fulfilledAt: { gte: since } } : {}),
      },
      include: { items: { include: { product: true } } },
    }),
    prisma.inventory.findMany({ include: { product: true } }),
  ]);

  let revenue = 0;
  let cost = 0;
  let units = 0;
  const perProduct = new Map<string, { name: string; units: number; revenue: number; cost: number }>();
  for (const r of fulfilled) {
    for (const it of r.items) {
      const lineRev = it.lineTotal ?? (it.unitPrice ?? 0) * it.quantity;
      const lineCost = it.product.costPrice * it.quantity;
      revenue += lineRev;
      cost += lineCost;
      units += it.quantity;
      const cur = perProduct.get(it.productId) ?? { name: it.product.name, units: 0, revenue: 0, cost: 0 };
      cur.units += it.quantity;
      cur.revenue += lineRev;
      cur.cost += lineCost;
      perProduct.set(it.productId, cur);
    }
  }
  const net = revenue - cost;
  const margin = revenue > 0 ? (net / revenue) * 100 : 0;

  const inventoryCost = inventories.reduce((s, i) => s + i.warehouseQty * i.product.costPrice, 0);
  const potentialRevenue = inventories.reduce((s, i) => s + i.warehouseQty * i.product.price, 0);
  const potentialProfit = potentialRevenue - inventoryCost;

  const topProducts = [...perProduct.values()]
    .map((p) => ({ ...p, profit: p.revenue - p.cost, margin: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0 }))
    .sort((a, b) => b.profit - a.profit);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profit & margins"
        description="Real profit from fulfilled orders — selling price minus cost, per pack."
      >
        <div className="inline-flex rounded-lg bg-muted p-1">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={`/admin/profit?period=${p.key}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                period === p.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total revenue" value={revenue} prefix="TSh " icon={TrendingUp} accent="success" hint={`${formatNumber(units)} packs sold`} />
        <KpiCard label="Cost of goods" value={cost} prefix="TSh " icon={Package} accent="info" />
        <KpiCard label="Net profit" value={net} prefix="TSh " icon={Wallet} accent="primary" />
        <KpiCard label="Profit margin" value={Math.round(margin)} suffix="%" icon={Percent} accent="accent" />
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Value sitting in stock</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard label="Inventory value (cost)" value={inventoryCost} prefix="TSh " icon={Package} accent="info" />
          <KpiCard label="Potential revenue" value={potentialRevenue} prefix="TSh " icon={TrendingUp} accent="success" hint="if all sold at sell price" />
          <KpiCard label="Potential profit" value={potentialProfit} prefix="TSh " icon={Wallet} accent="primary" hint="locked in current stock" />
        </div>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          {topProducts.length === 0 ? (
            <EmptyState className="m-6" icon={TrendingUp} title="No sales in this period" />
          ) : (
            <Table wrapperClassName="table-stack">
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Packs</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.map((p) => (
                  <TableRow key={p.name}>
                    <TableCell data-cardtitle className="font-medium">{p.name}</TableCell>
                    <TableCell data-label="Packs" className="text-right">{formatNumber(p.units)}</TableCell>
                    <TableCell data-label="Revenue" className="text-right">{formatCurrency(p.revenue)}</TableCell>
                    <TableCell data-label="Profit" className="text-right font-medium text-success">{formatCurrency(p.profit)}</TableCell>
                    <TableCell data-label="Margin" className="text-right">{p.margin.toFixed(0)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
