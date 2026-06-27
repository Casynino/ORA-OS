import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  PackageCheck,
  MapPin,
  StickyNote,
  Clock,
  Truck,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { productMeta } from "@/lib/product-meta";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/utils";

const STEPS = [
  { key: "PENDING", label: "Submitted", hint: "Sent to the ORA team for review", icon: Clock },
  { key: "IN_TRANSIT", label: "Authorised — send to warehouse", hint: "Approved — ship the stock back", icon: Truck },
  { key: "COMPLETED", label: "Received & reconciled", hint: "Stock confirmed back at the warehouse", icon: CheckCircle2 },
] as const;
const ORDER = ["PENDING", "IN_TRANSIT", "COMPLETED"];

export default async function PartnerReturnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("PARTNER");
  const { id } = await params;

  const ret = await prisma.returnRequest.findUnique({
    where: { id },
    include: { product: { select: { name: true, sku: true } } },
  });
  if (!ret || ret.requesterId !== session.id) notFound();

  const pp = await prisma.partnerPrice.findUnique({
    where: {
      partnerId_productId: { partnerId: ret.requesterId, productId: ret.productId },
    },
    select: { price: true },
  });
  const product = await prisma.product.findUnique({
    where: { id: ret.productId },
    select: { price: true },
  });
  const unit = pp?.price ?? product?.price ?? 0;
  const value = unit * ret.quantity;
  const rejected = ret.status === "REJECTED";
  const reachedIdx = rejected ? -1 : ORDER.indexOf(ret.status);

  return (
    <div className="space-y-6">
      <PageHeader title={`Return ${ret.code}`} description="Track this return from request to reconciliation.">
        <Link href="/partner/returns" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to returns
        </Link>
      </PageHeader>

      {/* Summary */}
      <Card className={rejected ? "border-destructive/30" : ret.status === "COMPLETED" ? "border-success/30" : ""}>
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
                {formatNumber(ret.quantity)} units · {formatCurrency(value)}
              </p>
            </div>
          </div>
          {ret.status === "IN_TRANSIT" && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
              <Truck className="size-4" /> Authorised — please send the stock to{" "}
              {ret.warehouseName ?? "the warehouse"}
            </span>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageCheck className="size-4" /> Return details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 p-5 sm:grid-cols-2">
            <Item icon={PackageCheck} label="Reason" value={ret.reasonType ?? "—"} sub={ret.reason ?? undefined} />
            <Item icon={MapPin} label="Send back to" value={ret.warehouseName ?? "Main warehouse"} />
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

        {/* Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
          </CardHeader>
          <CardContent>
            {rejected ? (
              <div className="flex items-start gap-2.5 text-sm">
                <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">Return declined</p>
                  {ret.adminNote && <p className="text-muted-foreground">{ret.adminNote}</p>}
                </div>
              </div>
            ) : (
              <ol className="relative space-y-4 pl-5">
                <span className="absolute left-[5px] top-1 h-[calc(100%-0.5rem)] w-px bg-border" />
                {STEPS.map((s, idx) => {
                  const done = reachedIdx >= idx;
                  const current = reachedIdx === idx;
                  return (
                    <li key={s.key} className="relative">
                      <span className={`absolute -left-5 top-1 size-2.5 rounded-full ${done ? "bg-success" : "bg-muted-foreground/30"}`} />
                      <p className={`text-sm ${done ? "font-medium" : "text-muted-foreground"}`}>
                        {s.label}
                        {current && <span className="ml-2 text-xs text-accent">· current</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{s.hint}</p>
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
