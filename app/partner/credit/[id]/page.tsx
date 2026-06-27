import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  PackageCheck,
} from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";

const DAY = 24 * 60 * 60 * 1000;

export default async function CreditBatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("PARTNER");
  const { id } = await params;

  const a = await prisma.creditAccount.findUnique({
    where: { id },
    include: {
      request: {
        include: {
          items: { include: { product: { select: { name: true } } } },
        },
      },
      payments: {
        orderBy: { createdAt: "asc" },
        include: { recordedBy: { select: { name: true } } },
      },
    },
  });
  if (!a || a.agentId !== user.id) notFound();

  const left = Math.max(0, a.principal - a.amountPaid);
  const pct = a.principal > 0 ? (a.amountPaid / a.principal) * 100 : 0;
  const settled = a.status === "SETTLED";
  const isOverdue = a.status === "OVERDUE";
  const daysOver =
    a.dueDate && isOverdue
      ? Math.floor((Date.now() - a.dueDate.getTime()) / DAY)
      : 0;
  const termsDays = a.dueDate
    ? Math.round((a.dueDate.getTime() - a.createdAt.getTime()) / DAY)
    : null;
  const totalQty = a.request.items.reduce((s, i) => s + i.quantity, 0);

  let running = 0;
  const ledger = a.payments.map((p) => {
    running += p.amount;
    return { ...p, balanceAfter: Math.max(0, a.principal - running) };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Credit batch ${a.request.code}`}
        description="The full lifecycle of this credit cycle — goods taken, terms, and every repayment."
      >
        <Link
          href="/partner/credit"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to debt & payments
        </Link>
      </PageHeader>

      <Card
        className={
          isOverdue ? "border-warning/40" : settled ? "border-success/30" : ""
        }
      >
        <CardContent className="p-5">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-xl font-semibold">
                  {a.request.code}
                </h3>
                <StatusBadge status={a.status} />
                {a.request.invoiceNo && (
                  <Badge variant="secondary">{a.request.invoiceNo}</Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Issued {formatDate(a.createdAt)}
                {termsDays != null ? ` · ${termsDays}-day terms` : ""}
                {a.dueDate ? ` · due ${formatDate(a.dueDate)}` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Value of goods</p>
              <p className="font-display text-2xl font-semibold">
                {formatCurrency(a.principal)}
              </p>
            </div>
          </div>

          {/* Products on credit */}
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Stock taken on credit
            </p>
            <div className="flex flex-wrap gap-2">
              {a.request.items.map((i, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1 text-sm"
                >
                  <PackageCheck className="size-4 text-muted-foreground" />
                  {i.product.name}
                  <span className="text-muted-foreground">
                    ×{formatNumber(i.quantity)}
                  </span>
                </span>
              ))}
              <span className="inline-flex items-center rounded-lg px-2.5 py-1 text-sm text-muted-foreground">
                {formatNumber(totalQty)} units total
              </span>
            </div>
          </div>

          {/* Amounts + progress */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            <Amount label="Total" value={a.principal} />
            <Amount label="Paid" value={a.amountPaid} tone="text-success" />
            <Amount
              label={settled ? "Cleared" : "Remaining"}
              value={settled ? 0 : left}
              tone={isOverdue ? "text-warning" : undefined}
            />
          </div>
          <Progress value={pct} className="mt-3" />
          <div className="mt-2 text-xs">
            {settled ? (
              <span className="inline-flex items-center gap-1.5 text-success">
                <CheckCircle2 className="size-3.5" /> Fully settled
              </span>
            ) : isOverdue ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-warning">
                <AlertTriangle className="size-3.5" /> Overdue by {daysOver} day
                {daysOver === 1 ? "" : "s"}
              </span>
            ) : (
              <span className="text-muted-foreground">
                {Math.round(pct)}% repaid
              </span>
            )}
          </div>

          {/* Ledger */}
          <div className="mt-6 border-t border-border pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Repayment ledger
            </p>
            <ol className="relative space-y-4 pl-5">
              <span className="absolute left-[5px] top-1 h-[calc(100%-0.5rem)] w-px bg-border" />
              <li className="relative">
                <span className="absolute -left-5 top-1 size-2.5 rounded-full bg-primary" />
                <div className="flex justify-between text-sm">
                  <span>
                    <span className="font-medium">Credit issued</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDate(a.createdAt)} · stock delivered
                    </span>
                  </span>
                  <span className="font-medium">
                    {formatCurrency(a.principal)}
                  </span>
                </div>
              </li>
              {ledger.map((p) => (
                <li key={p.id} className="relative">
                  <span className="absolute -left-5 top-1 size-2.5 rounded-full bg-success" />
                  <div className="flex justify-between gap-3 text-sm">
                    <span>
                      <span className="font-medium text-success">
                        + {formatCurrency(p.amount)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDate(p.createdAt)}
                        {p.method ? ` · ${p.method}` : ""} · recorded by{" "}
                        {p.recordedBy.name}
                        {p.note ? ` · ${p.note}` : ""}
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      balance {formatCurrency(p.balanceAfter)}
                    </span>
                  </div>
                </li>
              ))}
              <li className="relative">
                <span
                  className={`absolute -left-5 top-1 size-2.5 rounded-full ${
                    settled
                      ? "bg-success"
                      : isOverdue
                        ? "bg-warning"
                        : "bg-muted-foreground/40"
                  }`}
                />
                <div className="flex justify-between text-sm">
                  <span className="font-medium">
                    {settled
                      ? "Completed — cycle closed"
                      : "Balance outstanding"}
                  </span>
                  {!settled && (
                    <span className="font-medium">{formatCurrency(left)}</span>
                  )}
                </div>
              </li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Need to make a payment or have a question on this batch? Reach out to the
        ORA team.
      </p>
    </div>
  );
}

function Amount({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-medium ${tone ?? ""}`}>{formatCurrency(value)}</p>
    </div>
  );
}
