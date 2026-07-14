import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, PackageCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { productMeta } from "@/lib/product-meta";
import {
  CreditOrderManager,
  type CreditOrderDTO,
} from "@/components/admin/credit-order-manager";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminCreditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");
  const { id } = await params;

  const a = await prisma.creditAccount.findUnique({
    where: { id },
    include: {
      request: {
        include: {
          items: { include: { product: { select: { name: true, sku: true } } } },
        },
      },
      agent: {
        select: {
          id: true,
          name: true,
          organization: true,
          businessType: true,
          creditLimit: true,
        },
      },
      payments: {
        orderBy: { createdAt: "asc" },
        include: { recordedBy: { select: { name: true } } },
      },
      settlementRequests: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!a) notFound();

  const receivingAccounts = await prisma.paymentAccount.findMany({
    where: { isActive: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: { id: true, name: true, type: true, details: true },
  });

  let running = 0;
  const payments = a.payments.map((p) => {
    running += p.amount;
    return {
      id: p.id,
      amount: p.amount,
      method: p.method,
      note: p.note,
      recordedBy: p.recordedBy.name,
      createdAt: p.createdAt.toISOString(),
      balanceAfter: Math.max(0, a.principal - running),
    };
  });

  const dto: CreditOrderDTO = {
    id: a.id,
    code: a.request.code,
    invoiceNo: a.request.invoiceNo,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
    dueDate: a.dueDate ? a.dueDate.toISOString() : null,
    partner: {
      id: a.agent.id,
      name: a.agent.name,
      organization: a.agent.organization,
      businessType: a.agent.businessType,
      creditLimit: a.agent.creditLimit ?? 0,
    },
    principal: a.principal,
    amountPaid: a.amountPaid,
    remaining: Math.max(0, a.principal - a.amountPaid),
    warehouse: a.request.warehouseName,
    deliveryStatus: a.request.status,
    issuedAt: a.request.fulfilledAt ? a.request.fulfilledAt.toISOString() : null,
    deliveredAt: a.request.deliveredAt
      ? a.request.deliveredAt.toISOString()
      : null,
    items: a.request.items.map((i) => ({
      name: i.product.name,
      size: productMeta(i.product.sku).size,
      quantity: i.quantity,
      unitPrice: i.unitPrice ?? 0,
      lineTotal: i.lineTotal ?? (i.unitPrice ?? 0) * i.quantity,
    })),
    payments,
    settlements: a.settlementRequests.map((s) => ({
      id: s.id,
      code: s.code,
      amount: s.amount,
      method: s.method,
      reference: s.reference,
      note: s.note,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
    })),
  };

  return (
    <div className="space-y-6">
      <Link
        href="/admin/credit"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Credit & Settlements
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Credit order {dto.code}
            </h1>
            <StatusBadge status={dto.status} />
            <Badge variant="accent">Credit (pay-later)</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {dto.partner.organization ?? dto.partner.name}
            {dto.partner.businessType ? ` · ${dto.partner.businessType}` : ""} ·
            Opened {formatDate(dto.createdAt)}
            {dto.invoiceNo ? ` · Invoice ${dto.invoiceNo}` : ""}
          </p>
        </div>
        <Link
          href={`/admin/customers/${dto.partner.id}`}
          className="text-sm text-primary hover:underline"
        >
          View customer profile →
        </Link>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
        {/* Order information */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="font-display text-lg font-semibold">Order information</h2>
          <div className="mt-3 space-y-1.5">
            {dto.items.map((i, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm"
              >
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <PackageCheck className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {i.size} {i.name}
                  </span>
                  <span className="shrink-0 text-muted-foreground">×{i.quantity}</span>
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {formatCurrency(i.unitPrice)} ea ·{" "}
                  <span className="font-medium text-foreground">
                    {formatCurrency(i.lineTotal)}
                  </span>
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between px-3 pt-2 text-sm font-semibold">
              <span>Total amount</span>
              <span className="font-display text-lg text-primary">
                {formatCurrency(dto.principal)}
              </span>
            </div>
          </div>
        </section>

        {/* Interactive credit management */}
        <CreditOrderManager order={dto} receivingAccounts={receivingAccounts} />
      </div>
    </div>
  );
}
