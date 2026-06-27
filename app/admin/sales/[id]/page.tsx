import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, User, Receipt, CalendarClock, CreditCard } from "lucide-react";
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

export default async function AdminSaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");
  const { id } = await params;

  const sale = await prisma.request.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { name: true, sku: true } } } },
      requester: {
        select: {
          name: true,
          email: true,
          phone: true,
          businessType: true,
          organization: true,
          region: true,
        },
      },
      reviewedBy: { select: { name: true } },
      creditAccount: { select: { id: true, status: true, amountPaid: true, principal: true } },
    },
  });
  if (!sale || sale.status !== "FULFILLED") notFound();

  const isWalkin = sale.requester.email === WALKIN_EMAIL;
  const buyer = isWalkin
    ? sale.deliverTo?.trim() || "Walk-in customer"
    : sale.requester.name;
  const buyerType = isWalkin
    ? "Field / walk-in sale"
    : sale.requester.businessType ||
      sale.requester.organization ||
      "Registered partner";

  const subtotal = sale.items.reduce(
    (s, i) => s + (i.lineTotal ?? (i.unitPrice ?? 0) * i.quantity),
    0,
  );
  const code = sale.code.replace("REQ", "SALE");
  const totalQty = sale.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="space-y-6">
      <PageHeader title={`Sale ${code}`} description="Full record of this sale.">
        <Link
          href="/admin/sales"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to sales
        </Link>
      </PageHeader>

      {/* Summary strip */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="size-4" /> Customer
            </div>
            <p className="mt-1.5 font-display text-lg font-semibold">{buyer}</p>
            <p className="text-sm text-muted-foreground">{buyerType}</p>
            {!isWalkin && (sale.requester.phone || sale.requester.region) && (
              <p className="mt-1 text-xs text-muted-foreground">
                {[sale.requester.phone, sale.requester.region]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {isWalkin && <Badge variant="outline" className="mt-2">Field sale</Badge>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Receipt className="size-4" /> Payment
            </div>
            <p className="mt-1.5 font-display text-lg font-semibold">
              {formatCurrency(sale.totalAmount)}
            </p>
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
              <span className="text-muted-foreground">Sold:</span>{" "}
              {formatDateTime(sale.fulfilledAt ?? sale.createdAt)}
            </p>
            {sale.invoiceNo && (
              <p className="text-sm">
                <span className="text-muted-foreground">Invoice:</span>{" "}
                {sale.invoiceNo}
              </p>
            )}
            {sale.reviewedBy && (
              <p className="text-sm">
                <span className="text-muted-foreground">Recorded by:</span>{" "}
                {sale.reviewedBy.name}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Line items */}
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
                    <div className="font-medium">{i.product.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {productMeta(i.product.sku).size}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(i.quantity)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrency(i.unitPrice ?? 0)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(i.lineTotal ?? (i.unitPrice ?? 0) * i.quantity)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Totals */}
          <div className="space-y-1.5 border-t border-border p-4 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal ({formatNumber(totalQty)} units)</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span>−{formatCurrency(sale.discount)}</span>
              </div>
            )}
            {sale.deliveryCharge > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery</span>
                <span>{formatCurrency(sale.deliveryCharge)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1.5 text-base font-semibold">
              <span>Total</span>
              <span>{formatCurrency(sale.totalAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Note + credit link */}
      {(sale.note || sale.creditAccount) && (
        <Card>
          <CardContent className="space-y-3 p-5 text-sm">
            {sale.note && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Notes
                </p>
                <p className="mt-1">{sale.note}</p>
              </div>
            )}
            {sale.creditAccount && (
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="inline-flex items-center gap-2">
                  <CreditCard className="size-4 text-muted-foreground" />
                  Sold on credit ·{" "}
                  {formatCurrency(
                    sale.creditAccount.principal - sale.creditAccount.amountPaid,
                  )}{" "}
                  outstanding
                </span>
                <Link
                  href="/admin/credit"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Open in Credit →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
