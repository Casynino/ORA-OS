import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  User as UserIcon,
  Phone,
  Mail,
  MapPin,
  CalendarDays,
  CreditCard,
  Wallet,
  TrendingUp,
  Banknote,
  AlertTriangle,
  ShoppingCart,
  Undo2,
  Activity as ActivityIcon,
  MessageSquare,
  Package,
  Hash,
  FileText,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CustomerActions } from "@/components/admin/customer-actions";
import {
  cn,
  formatCurrency,
  formatNumber,
  formatDate,
  formatDateTime,
  humanize,
  timeAgo,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");
  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role !== "PARTNER") notFound();

  const [creditAccounts, requests, returns, messages, activity, warehouses] =
    await Promise.all([
      prisma.creditAccount.findMany({
        where: { agentId: id },
        orderBy: { createdAt: "desc" },
        include: {
          request: { select: { code: true, items: { select: { quantity: true, product: { select: { name: true } } } } } },
          payments: { orderBy: { createdAt: "desc" }, include: { recordedBy: { select: { name: true } } } },
        },
      }),
      prisma.request.findMany({
        where: { requesterId: id },
        orderBy: { createdAt: "desc" },
        include: { items: { include: { product: { select: { name: true, sku: true } } } } },
      }),
      prisma.returnRequest.findMany({
        where: { requesterId: id },
        orderBy: { createdAt: "desc" },
        include: { product: { select: { name: true } } },
      }),
      prisma.contactMessage.findMany({
        where: { senderId: id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.activityLog.findMany({
        where: { OR: [{ entityId: id }, { actorId: id }] },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
      prisma.warehouse.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

  // ── Financials ─────────────────────────────────────────────────
  const creditLimit = user.creditLimit ?? 0;
  const now = new Date();
  const activeCredits = creditAccounts.filter((c) => c.status !== "SETTLED");
  const outstanding = activeCredits.reduce(
    (s, c) => s + Math.max(0, c.principal - c.amountPaid),
    0,
  );
  const availableCredit = Math.max(0, creditLimit - outstanding);
  const allPayments = creditAccounts.flatMap((c) =>
    c.payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      method: p.method,
      note: p.note,
      recordedBy: p.recordedBy.name,
      createdAt: p.createdAt,
      accountCode: c.request.code,
    })),
  );
  const totalPaid = allPayments.reduce((s, p) => s + p.amount, 0);
  const fulfilled = requests.filter((r) => r.status === "FULFILLED");
  // Purchases = every priced, committed order (approved → delivered), so the
  // figure reconciles with paid + outstanding for credit partners.
  const purchasedOrders = requests.filter(
    (r) =>
      ["APPROVED", "IN_TRANSIT", "FULFILLED"].includes(r.status) &&
      r.totalAmount != null,
  );
  const totalPurchased = purchasedOrders.reduce(
    (s, r) => s + (r.totalAmount ?? 0),
    0,
  );
  const overdue = activeCredits.filter(
    (c) =>
      (c.status === "OVERDUE" || (c.dueDate ? c.dueDate < now : false)) &&
      c.principal - c.amountPaid > 0,
  );
  const dueDates = activeCredits
    .filter((c) => c.dueDate && c.principal - c.amountPaid > 0)
    .map((c) => c.dueDate as Date)
    .sort((a, b) => a.getTime() - b.getTime());
  const nextDue = dueDates[0] ?? null;
  const principalTotal = activeCredits.reduce((s, c) => s + c.principal, 0);
  const paidPct =
    principalTotal > 0
      ? Math.round(
          (activeCredits.reduce((s, c) => s + c.amountPaid, 0) / principalTotal) *
            100,
        )
      : 100;
  const performance =
    overdue.length > 0
      ? { label: `${overdue.length} overdue`, tone: "text-destructive" }
      : activeCredits.length > 0
        ? { label: "On track", tone: "text-success" }
        : { label: "No credit", tone: "text-muted-foreground" };

  // ── Stock currently with this customer (per product) ───────────
  const byProduct = new Map<
    string,
    { name: string; credit: number; inTransit: number; delivered: number }
  >();
  const bump = (name: string, key: "credit" | "inTransit" | "delivered", q: number) => {
    const cur = byProduct.get(name) ?? { name, credit: 0, inTransit: 0, delivered: 0 };
    cur[key] += q;
    byProduct.set(name, cur);
  };
  for (const c of activeCredits)
    for (const i of c.request.items) bump(i.product.name, "credit", i.quantity);
  for (const r of requests) {
    if (r.status === "IN_TRANSIT")
      for (const i of r.items) bump(i.product.name, "inTransit", i.quantity);
    if (r.status === "FULFILLED")
      for (const i of r.items) bump(i.product.name, "delivered", i.quantity);
  }
  const stockRows = [...byProduct.values()].filter(
    (p) => p.credit || p.inTransit || p.delivered,
  );

  const STATUS_GROUPS = ["PENDING", "PRICED", "APPROVED", "IN_TRANSIT", "FULFILLED", "REJECTED", "CANCELLED"] as const;
  const orderCounts = STATUS_GROUPS.map((s) => ({
    s,
    n: requests.filter((r) => r.status === s).length,
  })).filter((x) => x.n > 0);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/customers"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All customers
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {user.organization ?? user.name}
            </h1>
            <StatusBadge status={user.status} />
            {user.businessType && <Badge variant="accent">{user.businessType}</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {user.name} · Partner since {formatDate(user.createdAt)}
          </p>
        </div>
        <CustomerActions
          warehouses={warehouses}
          customer={{
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            organization: user.organization,
            businessType: user.businessType,
            location: user.location,
            region: user.region,
            district: user.district,
            street: user.street,
            expectedVolume: user.expectedVolume,
            taxId: user.taxId,
            businessLicense: user.businessLicense,
            preferredPayment: user.preferredPayment,
            paymentTerms: user.paymentTerms,
            assignedWarehouse: user.assignedWarehouse,
            notes: user.notes,
            creditLimit: user.creditLimit,
            status: user.status,
          }}
        />
      </div>

      {/* Financial overview */}
      <section>
        <SectionLabel>Financial overview</SectionLabel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile icon={CreditCard} accent="info" label="Credit limit" value={formatCurrency(creditLimit)} hint={user.preferredPayment ?? "—"} />
          <Tile icon={Wallet} accent="success" label="Available credit" value={formatCurrency(availableCredit)} />
          <Tile icon={AlertTriangle} accent={outstanding > 0 ? "warning" : "success"} label="Outstanding" value={formatCurrency(outstanding)} />
          <Tile icon={TrendingUp} accent="primary" label="Total purchased" value={formatCurrency(totalPurchased)} hint={`${purchasedOrders.length} orders · ${fulfilled.length} delivered`} />
          <Tile icon={Banknote} accent="success" label="Total paid" value={formatCurrency(totalPaid)} hint={`${allPayments.length} payments`} />
          <Tile icon={CalendarDays} accent="info" label="Next payment due" value={nextDue ? formatDate(nextDue) : "—"} />
          <Tile icon={ActivityIcon} accent="accent" label="Payment performance" value={performance.label} valueClass={performance.tone} hint={`${paidPct}% of credit repaid`} />
          <Tile icon={CreditCard} accent="warning" label="Payment terms" value={user.paymentTerms ?? "—"} />
        </div>
      </section>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* Business info */}
        <section>
          <SectionLabel>Business information</SectionLabel>
          <div className="glass-card rounded-2xl p-5 sm:p-6">
            <dl className="space-y-3 text-sm">
              <Row icon={Building2} label="Business name" value={user.organization ?? "—"} />
              <Row icon={UserIcon} label="Contact person" value={user.name} />
              <Row icon={Phone} label="Phone" value={user.phone ?? "—"} />
              <Row icon={Mail} label="Email" value={user.email} />
              <Row icon={MapPin} label="Full address" value={user.location ?? "—"} />
              <Row icon={MapPin} label="Region" value={user.region ?? "—"} />
              <Row icon={MapPin} label="District" value={user.district ?? "—"} />
              <Row icon={MapPin} label="Street" value={user.street ?? "—"} />
              <Row icon={Building2} label="Partner type" value={user.businessType ?? "—"} />
              <Row icon={Hash} label="TIN number" value={user.taxId ?? "—"} />
              <Row icon={FileText} label="Business reg. no." value={user.businessLicense ?? "—"} />
              <Row icon={TrendingUp} label="Expected volume" value={user.expectedVolume ?? "—"} />
              <Row icon={Package} label="Fulfilling warehouse" value={user.assignedWarehouse ?? "Main warehouse (default)"} />
              <Row icon={CalendarDays} label="Registered" value={formatDate(user.createdAt)} />
              <Row icon={ActivityIcon} label="Status" value={humanize(user.status)} />
            </dl>
            {user.notes && (
              <div className="mt-4 rounded-xl bg-muted/40 p-3 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Internal notes</p>
                <p className="mt-1">{user.notes}</p>
              </div>
            )}
          </div>
        </section>

        {/* Stock with customer */}
        <section>
          <SectionLabel>Stock with this customer</SectionLabel>
          <div className="glass-card overflow-hidden rounded-2xl">
            {stockRows.length === 0 ? (
              <EmptyState className="m-6" icon={Package} title="No stock with this customer" description="Credit holdings, in-transit and delivered units will show here." />
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 text-right font-medium">On credit</th>
                    <th className="px-4 py-3 text-right font-medium">In transit</th>
                    <th className="px-4 py-3 text-right font-medium">Delivered</th>
                  </tr>
                </thead>
                <tbody>
                  {stockRows.map((p) => (
                    <tr key={p.name} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-right">{p.credit ? <span className="text-warning">{formatNumber(p.credit)}</span> : "—"}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{p.inTransit ? formatNumber(p.inTransit) : "—"}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{p.delivered ? formatNumber(p.delivered) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Order history */}
      <section>
        <SectionLabel>
          Order history
          {orderCounts.length > 0 && (
            <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground">
              {orderCounts.map((o) => `${o.n} ${o.s.toLowerCase()}`).join(" · ")}
            </span>
          )}
        </SectionLabel>
        <div className="space-y-2">
          {requests.length === 0 ? (
            <EmptyState className="glass-card rounded-2xl py-10" icon={ShoppingCart} title="No orders yet" />
          ) : (
            requests.map((r) => (
              <div key={r.id} className="glass-card rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{r.code}</span>
                    <Badge variant={r.paymentType === "CREDIT" ? "accent" : "secondary"}>{humanize(r.paymentType)}</Badge>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">{formatDate(r.createdAt)}</span>
                    <span className="font-semibold">{r.totalAmount != null ? formatCurrency(r.totalAmount) : "—"}</span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {r.items.map((i) => (
                    <span key={i.id}>{i.product.name} × {formatNumber(i.quantity)}</span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Payment history */}
        <section>
          <SectionLabel>Payment history</SectionLabel>
          <div className="glass-card overflow-hidden rounded-2xl">
            {allPayments.length === 0 ? (
              <EmptyState className="m-6" icon={Banknote} title="No payments recorded" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Method</th>
                    <th className="px-4 py-3 font-medium">By</th>
                  </tr>
                </thead>
                <tbody>
                  {allPayments.map((p) => (
                    <tr key={p.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDate(p.createdAt)}</td>
                      <td className="px-4 py-3 text-right font-medium text-success">{formatCurrency(p.amount)}</td>
                      <td className="px-4 py-3">{p.method ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.recordedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Return history */}
        <section>
          <SectionLabel>Return history</SectionLabel>
          <div className="glass-card rounded-2xl p-2">
            {returns.length === 0 ? (
              <EmptyState className="m-4" icon={Undo2} title="No returns" />
            ) : (
              <div className="divide-y divide-border/60">
                {returns.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{r.code} · {r.product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(r.quantity)} units · {r.warehouseName ?? "warehouse TBD"} · {formatDate(r.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Activity timeline */}
        <section>
          <SectionLabel>Activity timeline</SectionLabel>
          <div className="glass-card rounded-2xl p-5 sm:p-6">
            {activity.length === 0 ? (
              <EmptyState icon={ActivityIcon} title="No activity yet" />
            ) : (
              <div className="relative space-y-4 pl-5">
                <span className="absolute left-[5px] top-1 h-[calc(100%-0.5rem)] w-px bg-border" />
                {activity.map((a) => (
                  <div key={a.id} className="relative">
                    <span className="absolute -left-5 top-1 size-2.5 rounded-full bg-primary/70" />
                    <p className="text-sm leading-snug">{a.summary}</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(a.createdAt)} · {formatDateTime(a.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Conversation history */}
        <section>
          <SectionLabel>Conversations</SectionLabel>
          <div className="glass-card rounded-2xl p-5 sm:p-6">
            {messages.length === 0 ? (
              <EmptyState icon={MessageSquare} title="No messages" description="Messages this partner sends to the ORA team appear here." />
            ) : (
              <div className="space-y-3">
                {messages.map((m) => (
                  <div key={m.id} className="rounded-xl border border-border/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{m.subject ?? "Message"}</p>
                      <StatusBadge status={m.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{m.body}</p>
                    {m.reply && (
                      <div className="mt-2 rounded-md bg-primary/5 p-2.5">
                        <p className="text-xs font-medium text-primary">ORA team replied</p>
                        <p className="text-sm">{m.reply}</p>
                      </div>
                    )}
                    <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(m.createdAt)}</p>
                  </div>
                ))}
                <Link href="/admin/messages" className="block text-center text-xs text-muted-foreground hover:text-foreground">
                  Open Messages →
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/* helpers */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>;
}

const TILE_ACCENT: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/12 text-accent",
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-warning",
  info: "bg-info/12 text-info",
};

function Tile({
  icon: Icon,
  label,
  value,
  hint,
  accent = "primary",
  valueClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  accent?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", TILE_ACCENT[accent])}>
          <Icon className="size-3.5" />
        </span>
      </div>
      <p className={cn("mt-2 truncate font-display text-lg font-bold tracking-tight", valueClass)}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex shrink-0 items-center gap-2 text-muted-foreground">
        <Icon className="size-4 shrink-0" /> {label}
      </span>
      <span className="min-w-0 truncate text-right font-medium">{value}</span>
    </div>
  );
}
