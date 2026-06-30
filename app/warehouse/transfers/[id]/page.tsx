import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, PackageCheck } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { TransferActions } from "@/components/warehouse/transfer-actions";
import { formatDateTime, formatNumber } from "@/lib/utils";

const STEPS = ["PENDING", "APPROVED", "IN_TRANSIT", "COMPLETED"] as const;
const STEP_LABEL: Record<string, string> = {
  PENDING: "Created — awaiting acceptance",
  APPROVED: "Accepted",
  IN_TRANSIT: "Dispatched · in transit",
  COMPLETED: "Received & reconciled",
};

export default async function WarehouseTransferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("WAREHOUSE");
  const me = await prisma.user.findUnique({
    where: { id: session.id },
    select: { warehouseId: true },
  });
  const { id } = await params;

  const t = await prisma.warehouseTransfer.findUnique({
    where: { id },
    include: {
      from: { select: { id: true, name: true } },
      to: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      items: { include: { product: { select: { name: true } } } },
    },
  });
  if (!t || (me?.warehouseId !== t.fromId && me?.warehouseId !== t.toId)) {
    notFound();
  }

  const isSource = me?.warehouseId === t.fromId;
  const isDest = me?.warehouseId === t.toId;
  const units = t.items.reduce((s, i) => s + i.quantity, 0);
  const reachedIdx = t.status === "REJECTED" ? -1 : STEPS.indexOf(t.status as (typeof STEPS)[number]);

  return (
    <div className="space-y-6">
      <PageHeader title={`Transfer ${t.code}`} description="Review and act on this stock transfer.">
        <Link href="/warehouse/transfers" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to transfers
        </Link>
      </PageHeader>

      {/* Summary + action */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 font-display font-semibold">
                {t.from.name}
                <ArrowRight className="size-4 text-muted-foreground" />
                {t.to.name}
              </span>
              <StatusBadge status={t.status} />
              <Badge variant={isSource ? "accent" : "success"}>
                {isSource ? "Outgoing" : "Incoming"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.items.length} product{t.items.length === 1 ? "" : "s"} · {formatNumber(units)} units · created by {t.createdBy.name}
            </p>
          </div>
          <TransferActions id={t.id} status={t.status} isSource={isSource} isDest={isDest} />
        </CardContent>
      </Card>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageCheck className="size-4" /> Products
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {t.items.map((i, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-lg border border-border/60 p-3 text-sm">
                <span>{i.product.name}</span>
                <span className="font-medium">×{formatNumber(i.quantity)}</span>
              </div>
            ))}
            {t.note && (
              <p className="mt-2 rounded-lg bg-muted/40 p-3 text-sm">
                <span className="text-muted-foreground">Note: </span>{t.note}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
          </CardHeader>
          <CardContent>
            {t.status === "REJECTED" ? (
              <p className="text-sm font-medium text-destructive">This transfer was declined.</p>
            ) : (
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
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Created {formatDateTime(t.createdAt)}
              {t.dispatchedAt ? ` · dispatched ${formatDateTime(t.dispatchedAt)}` : ""}
              {t.receivedAt ? ` · received ${formatDateTime(t.receivedAt)}` : ""}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
