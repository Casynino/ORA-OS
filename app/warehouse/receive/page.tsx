import { PackagePlus, ArrowDownToLine, CalendarClock, Boxes } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ReceiveForm } from "@/components/warehouse/receive-form";
import { formatNumber, formatDateTime } from "@/lib/utils";

export default async function WarehouseReceivePage() {
  const session = await requireRole("WAREHOUSE");
  const me = await prisma.user.findUnique({
    where: { id: session.id },
    include: { warehouse: true },
  });
  const whId = me?.warehouse?.id ?? "";

  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startMonth = new Date();
  startMonth.setDate(1);
  startMonth.setHours(0, 0, 0, 0);

  const [products, stock, history, todayAgg, monthAgg] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true },
    }),
    prisma.warehouseStock.findMany({
      where: { warehouseId: whId },
      include: { product: { select: { name: true, sku: true, category: true } } },
      orderBy: { onHand: "desc" },
    }),
    prisma.stockMovement.findMany({
      where: { type: "INBOUND" },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: {
        product: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.stockMovement.aggregate({
      where: { type: "INBOUND", createdAt: { gte: startToday } },
      _sum: { quantity: true },
    }),
    prisma.stockMovement.aggregate({
      where: { type: "INBOUND", createdAt: { gte: startMonth } },
      _sum: { quantity: true },
    }),
  ]);

  const onHand = stock.reduce((s, r) => s + r.onHand, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receive stock"
        description={`Record incoming deliveries into ${me?.warehouse?.name ?? "the warehouse"}. Every receipt is logged and added to your stock.`}
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Received today" value={formatNumber(todayAgg._sum.quantity ?? 0)} hint="units" icon={ArrowDownToLine} accent="success" />
        <StatCard label="Received this month" value={formatNumber(monthAgg._sum.quantity ?? 0)} hint="units" icon={CalendarClock} accent="info" />
        <StatCard label="Stock on hand" value={formatNumber(onHand)} hint={`${stock.length} products`} icon={Boxes} accent="primary" />
        <StatCard label="Deliveries logged" value={formatNumber(history.length)} hint="most recent" icon={PackagePlus} accent="accent" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        {/* Form */}
        <Card className="glass-card lg:sticky lg:top-24 lg:self-start">
          <CardHeader>
            <CardTitle>Record a delivery</CardTitle>
          </CardHeader>
          <CardContent>
            <ReceiveForm products={products} />
          </CardContent>
        </Card>

        {/* Stock on hand (this warehouse) */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Stock on hand</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {stock.length === 0 ? (
              <EmptyState className="m-6" icon={Boxes} title="No stock yet" description="Received deliveries will appear here." />
            ) : (
              <Table wrapperClassName="table-stack">
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">On hand</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stock.map((r) => {
                    const low = r.onHand <= r.minLevel;
                    return (
                      <TableRow key={r.id}>
                        <TableCell data-cardtitle>
                          <div className="font-medium">{r.product.name}</div>
                          <div className="text-xs text-muted-foreground">{r.product.sku}</div>
                        </TableCell>
                        <TableCell data-label="On hand" className="text-right font-medium">{formatNumber(r.onHand)}</TableCell>
                        <TableCell data-label="Status">
                          {r.onHand <= 0 ? (
                            <Badge variant="destructive">Out</Badge>
                          ) : low ? (
                            <Badge variant="warning">Low</Badge>
                          ) : (
                            <Badge variant="success">In stock</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Receipt history */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowDownToLine className="size-4" /> Recent deliveries
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <EmptyState className="m-6" icon={PackagePlus} title="No receipts yet" description="Record a delivery to start the receipt log." />
          ) : (
            <Table wrapperClassName="table-stack">
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Received by</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell data-cardtitle className="font-medium">{m.product.name}</TableCell>
                      <TableCell data-label="Qty" className="text-right font-medium text-success">
                        +{formatNumber(m.quantity)}
                      </TableCell>
                      <TableCell data-label="Reference" className="text-sm text-muted-foreground">{m.reference ?? "—"}</TableCell>
                      <TableCell data-label="Received by" className="text-sm">{m.createdBy.name}</TableCell>
                      <TableCell data-label="Date" className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDateTime(m.createdAt)}
                      </TableCell>
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
