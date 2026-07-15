import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, User, PackageCheck, MapPin, StickyNote } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { productMeta } from "@/lib/product-meta";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { ReturnActions } from "@/components/warehouse/return-actions";
import { formatDateTime, formatNumber } from "@/lib/utils";

const STEPS = ["PENDING", "IN_TRANSIT", "COMPLETED"] as const;
const STEP_LABEL: Record<string, string> = {
  PENDING: "Submitted — awaiting review",
  IN_TRANSIT: "Authorised — coming back to warehouse",
  COMPLETED: "Received & reconciled",
};

export default async function WarehouseReturnDetailPage({
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

  const ret = await prisma.returnRequest.findUnique({
    where: { id },
    include: {
      product: { select: { name: true, sku: true } },
      requester: { select: { name: true, organization: true, phone: true } },
      reviewedBy: { select: { name: true } },
    },
  });
  // Warehouse staff only see returns routed to their own warehouse.
  if (!ret || !me?.warehouse || ret.warehouseName !== me.warehouse.name) {
    notFound();
  }

  const reachedIdx = ret.status === "REJECTED" ? -1 : STEPS.indexOf(ret.status as (typeof STEPS)[number]);

  return (
    <div className="space-y-6">
      <PageHeader title={`Return ${ret.code}`} description="Review this return and reconcile stock.">
        <Link href="/warehouse/returns" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to returns
        </Link>
      </PageHeader>

      {/* Summary + action */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
              <Image src={productMeta(ret.product.sku).image} alt={ret.product.name} fill className="object-cover" sizes="48px" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display font-semibold">{ret.product.name}</span>
                <StatusBadge status={ret.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {formatNumber(ret.quantity)} units
              </p>
            </div>
          </div>
          <ReturnActions id={ret.id} status={ret.status} />
        </CardContent>
      </Card>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageCheck className="size-4" /> Return details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 p-5 sm:grid-cols-2">
            <Item icon={User} label="Returned by" value={ret.requester.name} sub={ret.requester.organization ?? undefined} />
            <Item icon={MapPin} label="Send back to" value={ret.warehouseName ?? "Main warehouse"} />
            <Item
              icon={PackageCheck}
              label="Reason"
              value={ret.reasonType ?? "—"}
              sub={ret.reason ?? undefined}
            />
            <Item icon={User} label="Reviewed by" value={ret.reviewedBy?.name ?? "—"} />
            {ret.adminNote && (
              <div className="sm:col-span-2 flex items-start gap-2.5 rounded-lg bg-muted/40 p-3">
                <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">ORA team note</p>
                  <p className="text-sm">{ret.adminNote}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
          </CardHeader>
          <CardContent>
            {ret.status === "REJECTED" ? (
              <p className="text-sm font-medium text-destructive">This return was declined.</p>
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
              Requested {formatDateTime(ret.createdAt)}
              {ret.reviewedAt ? ` · reviewed ${formatDateTime(ret.reviewedAt)}` : ""}
              {ret.receivedAt ? ` · received ${formatDateTime(ret.receivedAt)}` : ""}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Item({
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
