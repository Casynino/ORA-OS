import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, User, Receipt, CalendarClock } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { WALKIN_EMAIL } from "@/lib/constants";
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
import { formatCurrency, formatDateTime, formatNumber, humanize } from "@/lib/utils";

export default async function WarehouseSaleDetailPage({
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

  const sale = await prisma.request.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { name: true, sku: true } } } },
      requester: { select: { name: true, email: true, organization: true, phone: true } },
      reviewedBy: { select: { name: true } },
    },
  });
  // Warehouse staff only see sales at their own warehouse.
  if (
    !sale ||
    sale.status !== "FULFILLED" ||
    (me?.warehouse && sale.warehouseName !== me.warehouse.name)
  ) {
    notFound();
  }

  const isWalkin = sale.requester.email === WALKIN_EMAIL;
  const buyer = isWalkin
    ? sale.deliverTo?.trim() || "Walk-in customer"
    : sale.requester.name;
  const code = sale.code.replace("REQ", "SALE");
  const totalQty = sale.items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = sale.items.reduce(
    (s, i) => s + (i.lineTotal ?? (i.unitPrice ?? 0) * i.quantity),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader title={`Sale ${code}`} description="Full record of this sale.">
        <Link href="/warehouse/sales" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to sales
        </Link>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="size-4" /> Customer
            </div>
            <p className="mt-1.5 font-display text-lg font-semibold">{buyer}</p>
            <p className="text-sm text-muted-foreground">
              {isWalkin ? "Field / walk-in sale" : sale.requester.organization ?? "Partner"}
            </p>
            {!isWalkin && sale.requester.phone && (
              <p className="mt-1 text-xs text-muted-foreground">{sale.requester.phone}</p>
            )}
            {isWalkin && <Badge variant="outline" className="mt-2">Field sale</Badge>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Receipt className="size-4" /> Payment
            </div>
            <p className="mt-1.5 font-display text-lg font-semibold">{formatCurrency(sale.totalAmount)}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant={sale.paymentType === "CREDIT" ? "accent" : "secondary"}>
                {humanize(sale.paymentType)}
              </Badge>
              <StatusBadge status={sale.paymentStatus} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="size-4" /> Record
            </div>
            <p className="mt-1.5 text-sm">
              <span className="text-muted-foreground">Sold:</span> {formatDateTime(sale.fulfilledAt ?? sale.createdAt)}
            </p>
            {sale.invoiceNo && (
              <p className="text-sm"><span className="text-muted-foreground">Invoice:</span> {sale.invoiceNo}</p>
            )}
            {sale.reviewedBy && (
              <p className="text-sm"><span className="text-muted-foreground">Recorded by:</span> {sale.reviewedBy.name}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Items sold</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right">Line total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span className="relative size-8 shrink-0 overflow-hidden rounded-md bg-muted">
                        <Image src={productMeta(i.product.sku).image} alt={i.product.name} fill className="object-cover" sizes="32px" />
                      </span>
                      <span className="text-sm">{i.product.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(i.quantity)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatCurrency(i.unitPrice ?? 0)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(i.lineTotal ?? (i.unitPrice ?? 0) * i.quantity)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-between border-t border-border p-4 text-sm font-semibold">
            <span>Total · {formatNumber(totalQty)} units</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
        </CardContent>
      </Card>

      {sale.note && (
        <Card>
          <CardContent className="p-5 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
            <p className="mt-1">{sale.note}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
