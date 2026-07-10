import { notFound } from "next/navigation";
import {
  CreditCard,
  Wallet,
  TrendingUp,
  ShieldAlert,
  CalendarClock,
  BadgeCheck,
  Send,
  Search,
  ClipboardCheck,
  PackageCheck,
  Truck,
  CheckCircle2,
} from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import {
  PartnerRequestBuilder,
  type BuilderProduct,
} from "@/components/dashboard/partner-request-builder";
import {
  RequestHistoryTable,
  type HistoryRow,
} from "@/components/dashboard/request-history-table";
import { productMeta } from "@/lib/product-meta";
import { formatCurrency, humanize } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TIMELINE = [
  { icon: Send, label: "Request submitted" },
  { icon: Search, label: "ORA team review" },
  { icon: ClipboardCheck, label: "Approval / rejection" },
  { icon: PackageCheck, label: "Order processing" },
  { icon: Truck, label: "Dispatch" },
  { icon: CheckCircle2, label: "Partner confirmation" },
];

function dispatchOf(status: string) {
  switch (status) {
    case "FULFILLED":
      return "Delivered";
    case "IN_TRANSIT":
      return "In transit";
    case "APPROVED":
      return "Approved";
    case "PRICED":
      return "Awaiting approval";
    case "REJECTED":
      return "—";
    default:
      return "Not started";
  }
}

export default async function PartnerRequestPage() {
  const session = await requireRole("PARTNER");
  const me = await prisma.user.findUnique({ where: { id: session.id } });
  if (!me) notFound();

  const [products, credits, fulfilled, lastReq, history, partnerPrices] =
    await Promise.all([
      prisma.product.findMany({
        where: { isActive: true, notForSale: false },
        orderBy: { price: "desc" },
      }),
      prisma.creditAccount.findMany({
        where: { agentId: me.id, status: { not: "SETTLED" } },
      }),
      prisma.request.findMany({
        where: { requesterId: me.id, status: "FULFILLED" },
        select: { totalAmount: true },
      }),
      prisma.request.findFirst({
        where: { requesterId: me.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.request.findMany({
        where: { requesterId: me.id },
        orderBy: { createdAt: "desc" },
        include: {
          items: { include: { product: true } },
          reviewedBy: { select: { name: true } },
        },
      }),
      prisma.partnerPrice.findMany({ where: { partnerId: me.id } }),
    ]);

  const partnerPriceMap = new Map(
    partnerPrices.map((pp) => [pp.productId, pp.price]),
  );

  const outstanding = credits.reduce(
    (s, c) => s + Math.max(0, c.principal - c.amountPaid),
    0,
  );
  // One definition of overdue everywhere — the flagged status the server
  // gate uses, so what the partner sees always matches what the rules do.
  const overdue = credits
    .filter((c) => c.status === "OVERDUE")
    .reduce((s, c) => s + Math.max(0, c.principal - c.amountPaid), 0);
  const hasOverdue = credits.some((c) => c.status === "OVERDUE");
  const limit = me.creditLimit ?? 0;
  const available = Math.max(0, limit - outstanding);
  const lifetime = fulfilled.reduce((s, r) => s + (r.totalAmount ?? 0), 0);

  const builderProducts: BuilderProduct[] = products.map((p) => {
    const m = productMeta(p.sku);
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      unitLabel: p.unitLabel,
      price: partnerPriceMap.get(p.id) ?? p.price,
      image: m.image,
      size: m.size,
      color: m.color,
      use: m.use,
      accent: m.accent,
    };
  });

  const historyRows: HistoryRow[] = history.map((r) => ({
    id: r.id,
    code: r.code,
    dateISO: r.createdAt.toISOString().slice(0, 10),
    dateLabel: r.createdAt.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    products: r.items.map((i) => `${i.product.name} ×${i.quantity}`).join(", "),
    totalQty: r.items.reduce((s, i) => s + i.quantity, 0),
    totalAmount: r.totalAmount,
    payment: r.paymentType === "CREDIT" ? "Credit" : "Cash",
    status: r.status,
    approvedBy: r.reviewedBy?.name ?? "—",
    dispatch: dispatchOf(r.status),
  }));

  const statusVariant =
    me.status === "ACTIVE"
      ? "success"
      : me.status === "PENDING"
        ? "warning"
        : "destructive";

  const overview = [
    { icon: CreditCard, label: "Credit limit", value: formatCurrency(limit) },
    {
      icon: Wallet,
      label: "Available credit",
      value: formatCurrency(available),
      accent: "text-success",
    },
    { icon: TrendingUp, label: "Outstanding", value: formatCurrency(outstanding) },
    {
      icon: ShieldAlert,
      label: "Overdue",
      value: formatCurrency(overdue),
      accent: overdue > 0 ? "text-destructive" : undefined,
    },
    {
      icon: CalendarClock,
      label: "Last order",
      value: lastReq
        ? lastReq.createdAt.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "—",
    },
    {
      icon: BadgeCheck,
      label: "Lifetime purchases",
      value: formatCurrency(lifetime),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Request stock"
        description="Build a request, choose payment and delivery, and submit it to the ORA team for review."
      />

      {/* Partner overview */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-semibold">
                {me.organization ?? me.name}
              </h2>
              <Badge variant="accent">{humanize(me.role)}</Badge>
              <Badge variant={statusVariant}>{humanize(me.status)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {me.name}
              {me.location ? ` · ${me.location}` : ""}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-3 xl:grid-cols-6">
          {overview.map((o) => (
            <div key={o.label} className="bg-card p-4">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <o.icon className="size-4" />
              </span>
              <p className="mt-2 text-xs text-muted-foreground">{o.label}</p>
              <p className={`font-display text-lg font-bold ${o.accent ?? ""}`}>
                {o.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Builder */}
      <PartnerRequestBuilder
        products={builderProducts}
        credit={{ limit, outstanding, available, overdue: hasOverdue }}
        customer={{
          name: me.name,
          phone: me.phone,
          organization: me.organization,
          location: me.location,
          preferredPayment: me.preferredPayment,
        }}
      />

      {/* Approval workflow */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="font-display text-lg font-semibold">How approval works</h2>
        <p className="text-sm text-muted-foreground">
          Requests aren&apos;t processed instantly — here&apos;s the journey
          after you submit.
        </p>
        <ol className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-2">
          {TIMELINE.map((step, i) => (
            <li
              key={step.label}
              className="flex items-center gap-3 sm:flex-1 sm:flex-col sm:items-center sm:text-center"
            >
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                  i === 0
                    ? "bg-gradient-to-br from-primary to-accent text-white shadow-glow"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <step.icon className="size-5" />
              </span>
              <span className="text-sm font-medium sm:mt-1">{step.label}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* History */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">
            Request history
          </h2>
          <p className="text-sm text-muted-foreground">
            Every request you&apos;ve made, with status and dispatch tracking.
          </p>
        </div>
        <RequestHistoryTable rows={historyRows} />
      </section>
    </div>
  );
}
