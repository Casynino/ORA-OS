import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, User, Receipt, MapPin, Phone, CalendarClock, Truck, StickyNote } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { productMeta } from "@/lib/product-meta";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { OrderFulfillActions } from "@/components/warehouse/order-fulfill-actions";
import { formatDateTime, formatNumber, humanize } from "@/lib/utils";

const STEPS = ["PRICED", "APPROVED", "IN_TRANSIT", "FULFILLED"] as const;
const STEP_LABEL: Record<string, string> = {
  PRICED: "Priced",
  APPROVED: "Approved",
  IN_TRANSIT: "Dispatched · in transit",
  FULFILLED: "Delivered",
};

export default async function WarehouseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("WAREHOUSE");
  const me = await prisma.user.findUnique({
    where: { id: session.id },
    include: { warehouse: true },
  });
  const { id } = await params;

  const order = await prisma.request.findUnique({
    where: { id },
    include: {
      requester: { select: { name: true, organization: true, phone: true, region: true } },
      items: {
        include: {
          product: { select: { name: true, sku: true, unitsPerCarton: true } },
        },
      },
    },
  });
  // Warehouse staff only see orders routed to their own warehouse — an
  // unassigned account sees nothing — and never before payment clears.
  if (
    !order ||
    !me?.warehouse ||
    order.warehouseName !== me.warehouse.name ||
    order.paymentStatus === "UNPAID"
  ) {
    notFound();
  }

  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
  const reachedIdx = STEPS.indexOf(order.status as (typeof STEPS)[number]);

  return (
    <div className="space-y-6">
      <PageHeader title={`Order ${order.code}`} description="Prepare, dispatch and confirm this order.">
        <Link
          href="/warehouse/orders"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to orders
        </Link>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="size-4" /> Partner
            </div>
            <p className="mt-1.5 font-display text-lg font-semibold">{order.requester.name}</p>
            <p className="text-sm text-muted-foreground">{order.requester.organization ?? "Partner"}</p>
            {(order.requester.phone || order.requester.region) && (
              <p className="mt-1 text-xs text-muted-foreground">
                {[order.requester.phone, order.requester.region].filter(Boolean).join(" · ")}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Receipt className="size-4" /> Order
            </div>
            <p className="mt-1.5 font-display text-lg font-semibold">
              {formatNumber(totalQty)} units
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant={order.paymentType === "CREDIT" ? "accent" : "secondary"}>
                {humanize(order.paymentType)}
              </Badge>
              <StatusBadge status={order.status} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="size-4" /> Destination
            </div>
            <p className="mt-1.5 text-sm">{order.deliverTo ?? order.requester.organization ?? "Partner site"}</p>
            <p className="text-xs text-muted-foreground">From {order.warehouseName ?? "—"}</p>
            {order.invoiceNo && <p className="mt-1 text-xs text-muted-foreground">Invoice {order.invoiceNo}</p>}
          </CardContent>
        </Card>
      </div>

      {/* Fulfillment action */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="font-medium">Fulfillment</p>
            <p className="text-sm text-muted-foreground">
              Inventory is drawn from {order.warehouseName ?? "your warehouse"} when you confirm delivery.
            </p>
          </div>
          <OrderFulfillActions
            id={order.id}
            status={order.status}
            items={order.items.map((i) => ({
              productId: i.productId,
              name: i.product.name,
              quantity: i.quantity,
            }))}
          />
        </CardContent>
      </Card>

      {/* Delivery details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="size-4" /> Delivery details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 p-5 sm:grid-cols-2">
          <DeliveryItem
            icon={MapPin}
            label="Deliver to"
            value={order.deliverTo ?? order.requester.organization ?? "Partner site"}
            sub={order.deliveryAddress ?? order.requester.region ?? undefined}
          />
          <DeliveryItem
            icon={Phone}
            label="Contact"
            value={order.contactName ?? order.requester.name}
            sub={order.contactPhone ?? order.requester.phone ?? "No phone on file"}
          />
          <DeliveryItem
            icon={CalendarClock}
            label="Preferred delivery"
            value={order.deliverBy ? formatDateTime(order.deliverBy) : "No date specified"}
          />
          <DeliveryItem
            icon={MapPin}
            label="Dispatch from"
            value={order.warehouseName ?? "—"}
            sub={order.invoiceNo ? `Invoice ${order.invoiceNo}` : undefined}
          />
          {order.note && (
            <div className="sm:col-span-2 flex items-start gap-2.5 rounded-lg bg-muted/40 p-3">
              <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Special instructions</p>
                <p className="text-sm">{order.note}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>Items to prepare</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table wrapperClassName="table-stack">
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Cartons</TableHead>
                <TableHead className="text-right">Pieces</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((i) => {
                const meta = productMeta(i.product.sku);
                const perCarton = i.product.unitsPerCarton || 24;
                return (
                  <TableRow key={i.id}>
                    <TableCell data-cardtitle>
                      <div className="flex items-center gap-2.5">
                        <span className="relative size-8 shrink-0 overflow-hidden rounded-md bg-muted">
                          <Image src={meta.image} alt={i.product.name} fill className="object-cover" sizes="32px" />
                        </span>
                        <span className="text-sm">{i.product.name}</span>
                      </div>
                    </TableCell>
                    <TableCell data-label="Cartons" className="text-right text-muted-foreground">
                      {formatNumber(Math.floor(i.quantity / perCarton))}
                      {i.quantity % perCarton ? ` +${formatNumber(i.quantity % perCarton)} pcs` : ""}
                    </TableCell>
                    <TableCell data-label="Pieces" className="text-right font-medium">{formatNumber(i.quantity)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex justify-between border-t border-border p-4 text-sm font-semibold">
            <span>Total to prepare</span>
            <span>{formatNumber(totalQty)} units</span>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="relative space-y-4 pl-5">
            <span className="absolute left-[5px] top-1 h-[calc(100%-0.5rem)] w-px bg-border" />
            {STEPS.map((s, idx) => {
              const done = reachedIdx >= idx && reachedIdx !== -1;
              return (
                <li key={s} className="relative">
                  <span className={`absolute -left-5 top-1 size-2.5 rounded-full ${done ? "bg-success" : "bg-muted-foreground/30"}`} />
                  <p className={`text-sm ${done ? "font-medium" : "text-muted-foreground"}`}>{STEP_LABEL[s]}</p>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">
            Submitted {formatDateTime(order.createdAt)}
            {order.fulfilledAt ? ` · delivered ${formatDateTime(order.fulfilledAt)}` : ""}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function DeliveryItem({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
