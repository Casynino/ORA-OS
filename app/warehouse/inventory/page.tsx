import Image from "next/image";
import { Boxes } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { productMeta } from "@/lib/product-meta";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatDate, formatNumber } from "@/lib/utils";

export default async function WarehouseInventoryPage() {
  const session = await requireRole("WAREHOUSE");
  const me = await prisma.user.findUnique({
    where: { id: session.id },
    include: { warehouse: true },
  });
  if (!me?.warehouse) {
    return (
      <EmptyState icon={Boxes} title="No warehouse assigned" description="Ask an ORA admin to assign you to a warehouse." />
    );
  }

  const [stock, reservedRows] = await Promise.all([
    prisma.warehouseStock.findMany({
      where: { warehouseId: me.warehouse.id },
      include: { product: { select: { name: true, sku: true } } },
      orderBy: { onHand: "desc" },
    }),
    // "Reserved" = committed to approved orders routed here but not yet delivered.
    prisma.requestItem.groupBy({
      by: ["productId"],
      where: {
        request: {
          warehouseName: me.warehouse.name,
          status: { in: ["APPROVED", "IN_TRANSIT"] },
        },
      },
      _sum: { quantity: true },
    }),
  ]);
  const reservedByProduct = new Map(
    reservedRows.map((r) => [r.productId, r._sum.quantity ?? 0]),
  );

  const onHand = stock.reduce((s, r) => s + r.onHand, 0);
  const reserved = stock.reduce(
    (s, r) => s + (reservedByProduct.get(r.productId) ?? 0),
    0,
  );
  const inTransit = stock.reduce((s, r) => s + r.inTransit, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description={`Stock held at ${me.warehouse.name}.`} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="On hand" value={formatNumber(onHand)} accent="success" />
        <StatCard label="Reserved" value={formatNumber(reserved)} accent="warning" />
        <StatCard label="In transit" value={formatNumber(inTransit)} accent="info" />
      </div>

      <Card>
        <CardContent className="p-0">
          {stock.length === 0 ? (
            <EmptyState className="m-6" icon={Boxes} title="No stock" description="This warehouse holds no stock yet." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Reserved</TableHead>
                    <TableHead className="text-right">In transit</TableHead>
                    <TableHead>Last updated</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stock.map((r) => {
                    const status =
                      r.onHand <= 0
                        ? { label: "Out of stock", variant: "destructive" as const }
                        : r.onHand <= r.minLevel
                          ? { label: "Low", variant: "warning" as const }
                          : { label: "In stock", variant: "success" as const };
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <span className="relative size-9 shrink-0 overflow-hidden rounded-md bg-muted">
                              <Image src={productMeta(r.product.sku).image} alt={r.product.name} fill className="object-cover" sizes="36px" />
                            </span>
                            <span className="text-sm font-medium">{r.product.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatNumber(r.onHand)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatNumber(reservedByProduct.get(r.productId) ?? 0)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatNumber(r.inTransit)}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {r.lastMoveAt ? formatDate(r.lastMoveAt) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
