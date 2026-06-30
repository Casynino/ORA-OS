import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Package,
  Coins,
  Boxes,
  ClipboardList,
  ArrowLeftRight,
  Undo2,
  MapPin,
  Activity as ActivityIcon,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { productMeta } from "@/lib/product-meta";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { EditWarehouseButton } from "@/components/admin/warehouse-forms";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "@/lib/utils";

const MOVE_LABEL: Record<string, string> = {
  ASSIGNED: "Reserved for order",
  DISTRIBUTED: "Dispatched to partner",
  RESTOCKED: "Returned to warehouse",
};

export default async function WarehouseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");
  const { id } = await params;

  const w = await prisma.warehouse.findUnique({
    where: { id },
    include: { staff: { select: { name: true, email: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!w) notFound();

  const [stock, transfers, movements, pendingReturns, activeOrders] =
    await Promise.all([
      prisma.warehouseStock.findMany({
        where: { warehouseId: id },
        include: { product: { select: { name: true, sku: true, price: true } } },
        orderBy: { onHand: "desc" },
      }),
      prisma.warehouseTransfer.findMany({
        where: { OR: [{ fromId: id }, { toId: id }] },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          from: { select: { name: true } },
          to: { select: { name: true } },
          items: true,
        },
      }),
      prisma.stockMovement.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { product: { select: { name: true } }, createdBy: { select: { name: true } } },
      }),
      prisma.returnRequest.count({
        where: { warehouseName: w.name, status: { in: ["PENDING", "IN_TRANSIT"] } },
      }),
      prisma.request.count({
        where: { warehouseName: w.name, status: { in: ["PENDING", "PRICED", "APPROVED", "IN_TRANSIT"] } },
      }),
    ]);

  const reservedRows = await prisma.requestItem.groupBy({
    by: ["productId"],
    where: {
      request: { warehouseName: w.name, status: { in: ["APPROVED", "IN_TRANSIT"] } },
    },
    _sum: { quantity: true },
  });
  const reservedByProduct = new Map(
    reservedRows.map((r) => [r.productId, r._sum.quantity ?? 0]),
  );

  const onHand = stock.reduce((s, r) => s + r.onHand, 0);
  const stockValue = stock.reduce((s, r) => s + r.onHand * r.product.price, 0);
  const pendingTransfers = transfers.filter(
    (t) => t.status !== "COMPLETED" && t.status !== "REJECTED",
  ).length;

  // Merge transfers + stock movements into one activity timeline.
  type Entry = { id: string; label: string; sub: string; time: Date; status?: string };
  const timeline: Entry[] = [
    ...transfers.map((t) => ({
      id: t.id,
      label:
        t.fromId === id
          ? `Transfer out → ${t.to.name}`
          : `Transfer in ← ${t.from.name}`,
      sub: `${t.code} · ${t.items.reduce((s, i) => s + i.quantity, 0)} units`,
      time: t.createdAt,
      status: t.status,
    })),
    ...movements.map((m) => ({
      id: m.id,
      label: MOVE_LABEL[m.type] ?? m.type,
      sub: `${m.product.name} · ${formatNumber(m.quantity)} · ${m.createdBy.name}${m.reference ? ` · ${m.reference}` : ""}`,
      time: m.createdAt,
    })),
  ]
    .sort((a, b) => b.time.getTime() - a.time.getTime())
    .slice(0, 12);

  return (
    <div className="space-y-6">
      <PageHeader
        title={w.name}
        description={[w.location, w.staff[0] ? `Manager: ${w.staff[0].name}` : "No manager assigned"]
          .filter(Boolean)
          .join(" · ")}
      >
        <div className="flex items-center gap-2">
          <EditWarehouseButton
            warehouse={{
              id: w.id,
              name: w.name,
              location: w.location,
              capacity: w.capacity,
              status: w.status,
            }}
          />
          <Link
            href="/admin/warehouses"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            All warehouses
          </Link>
        </div>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={w.status} />
        {w.location && (
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5" />
            {w.location}
          </span>
        )}
        {w.capacity && (
          <span className="text-sm text-muted-foreground">
            Capacity {formatNumber(w.capacity)} units ·{" "}
            {Math.min(100, Math.round((onHand / w.capacity) * 100))}% used
          </span>
        )}
      </div>

      {/* Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard label="Stock on hand" value={formatNumber(onHand)} icon={Package} accent="success" />
        <StatCard label="Stock value" value={formatCurrency(stockValue)} icon={Coins} accent="primary" />
        <StatCard label="Products" value={formatNumber(stock.length)} icon={Boxes} accent="info" />
        <StatCard label="Active orders" value={formatNumber(activeOrders)} icon={ClipboardList} accent="warning" />
        <StatCard label="Pending transfers" value={formatNumber(pendingTransfers)} icon={ArrowLeftRight} accent="info" />
        <StatCard label="Pending returns" value={formatNumber(pendingReturns)} icon={Undo2} accent="warning" />
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* Inventory */}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Inventory</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {stock.length === 0 ? (
              <EmptyState className="m-6" icon={Package} title="No stock" description="This warehouse holds no stock yet." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">On hand</TableHead>
                      <TableHead className="text-right">Reserved</TableHead>
                      <TableHead className="text-right">In transit</TableHead>
                      <TableHead className="text-right">Min</TableHead>
                      <TableHead>Last move</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stock.map((r) => {
                      const low = r.onHand <= r.minLevel;
                      return (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <span className="relative size-8 shrink-0 overflow-hidden rounded-md bg-muted">
                                <Image
                                  src={productMeta(r.product.sku).image}
                                  alt={r.product.name}
                                  fill
                                  className="object-cover"
                                  sizes="32px"
                                />
                              </span>
                              <span className="text-sm">{r.product.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={low ? "font-medium text-warning" : "font-medium"}>
                              {formatNumber(r.onHand)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatNumber(reservedByProduct.get(r.productId) ?? 0)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatNumber(r.inTransit)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatNumber(r.minLevel)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {r.lastMoveAt ? formatDate(r.lastMoveAt) : "—"}
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

        {/* Activity */}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ActivityIcon className="size-4" />
              Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <EmptyState icon={ActivityIcon} title="No activity" description="Stock movements will show here." />
            ) : (
              <ol className="relative space-y-4 pl-5">
                <span className="absolute left-[5px] top-1 h-[calc(100%-0.5rem)] w-px bg-border" />
                {timeline.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-5 top-1 size-2.5 rounded-full bg-primary/70" />
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{e.label}</p>
                        <p className="text-xs text-muted-foreground">{e.sub}</p>
                        <p className="text-[11px] text-muted-foreground">{formatDateTime(e.time)}</p>
                      </div>
                      {e.status && <StatusBadge status={e.status} className="shrink-0" />}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
