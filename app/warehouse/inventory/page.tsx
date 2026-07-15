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

  const [stock, outgoingRows] = await Promise.all([
    prisma.warehouseStock.findMany({
      where: { warehouseId: me.warehouse.id },
      include: {
        product: { select: { name: true, sku: true, unitsPerCarton: true } },
      },
      orderBy: { onHand: "desc" },
    }),
    // "Outgoing" = committed to approved partner orders routed here, not yet delivered.
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
  const outgoingByProduct = new Map(
    outgoingRows.map((r) => [r.productId, r._sum.quantity ?? 0]),
  );

  const onHand = stock.reduce((s, r) => s + r.onHand, 0);
  // Reserved = held for prepared rep pickups (WarehouseStock.reserved).
  const reserved = stock.reduce((s, r) => s + r.reserved, 0);
  const incoming = stock.reduce((s, r) => s + r.inTransit, 0);
  const outgoing = stock.reduce(
    (s, r) => s + (outgoingByProduct.get(r.productId) ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description={`Stock held at ${me.warehouse.name}.`} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Available" value={formatNumber(onHand)} hint="units on hand" accent="success" />
        <StatCard label="Reserved" value={formatNumber(reserved)} hint="held for pickup" accent="warning" />
        <StatCard label="Incoming" value={formatNumber(incoming)} hint="transfers arriving" accent="info" />
        <StatCard label="Outgoing" value={formatNumber(outgoing)} hint="committed to orders" accent="accent" />
      </div>

      <Card>
        <CardContent className="p-0">
          {stock.length === 0 ? (
            <EmptyState className="m-6" icon={Boxes} title="No stock" description="This warehouse holds no stock yet." />
          ) : (
            <div>
              <Table wrapperClassName="table-stack">
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Avail. cartons</TableHead>
                    <TableHead className="text-right">Avail. pieces</TableHead>
                    <TableHead className="text-right">Reserved</TableHead>
                    <TableHead className="text-right">Incoming</TableHead>
                    <TableHead className="text-right">Outgoing</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stock.map((r) => {
                    const perCarton = r.product.unitsPerCarton || 24;
                    const cartons = Math.floor(r.onHand / perCarton);
                    const loosePieces = r.onHand % perCarton;
                    const status =
                      r.onHand <= 0
                        ? { label: "Out of stock", variant: "destructive" as const }
                        : r.onHand <= r.minLevel
                          ? { label: "Low", variant: "warning" as const }
                          : { label: "In stock", variant: "success" as const };
                    return (
                      <TableRow key={r.id}>
                        <TableCell data-cardtitle>
                          <div className="flex items-center gap-2.5">
                            <span className="relative size-9 shrink-0 overflow-hidden rounded-md bg-muted">
                              <Image src={productMeta(r.product.sku).image} alt={r.product.name} fill className="object-cover" sizes="36px" />
                            </span>
                            <span className="text-sm font-medium">{r.product.name}</span>
                          </div>
                        </TableCell>
                        <TableCell data-label="Avail. cartons" className="text-right font-medium">
                          {formatNumber(cartons)}
                          {loosePieces ? <span className="text-xs text-muted-foreground"> +{formatNumber(loosePieces)}</span> : null}
                        </TableCell>
                        <TableCell data-label="Avail. pieces" className="text-right font-medium">{formatNumber(r.onHand)}</TableCell>
                        <TableCell data-label="Reserved" className="text-right text-muted-foreground">{formatNumber(r.reserved)}</TableCell>
                        <TableCell data-label="Incoming" className="text-right text-muted-foreground">{formatNumber(r.inTransit)}</TableCell>
                        <TableCell data-label="Outgoing" className="text-right text-muted-foreground">{formatNumber(outgoingByProduct.get(r.productId) ?? 0)}</TableCell>
                        <TableCell data-label="Status">
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
