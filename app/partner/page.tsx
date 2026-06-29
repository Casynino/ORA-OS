import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  ClipboardList,
  Clock,
  Truck,
  PackageCheck,
  Wallet,
  CreditCard,
  Coins,
  Boxes,
  PlusCircle,
  ArrowRight,
  ChevronRight,
  AlertCircle,
  Undo2,
  FileText,
  LifeBuoy,
  Newspaper,
  TrendingUp,
  ShoppingCart,
} from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { StatCard } from "@/components/ui/stat-card";
import { Progress } from "@/components/ui/progress";
import { BarChart, DonutChart } from "@/components/ui/charts";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";
import { buttonVariants } from "@/components/ui/button";
import { productMeta } from "@/lib/product-meta";
import { ORA_CONTACT } from "@/lib/constants";
import {
  cn,
  formatCurrency,
  formatNumber,
  humanize,
  timeAgo,
} from "@/lib/utils";

export default async function PartnerOverviewPage() {
  const session = await requireRole("PARTNER");
  const me = await prisma.user.findUnique({ where: { id: session.id } });
  if (!me) notFound();

  const [requests, credits, pendingReturns, news, products] = await Promise.all([
    prisma.request.findMany({
      where: { requesterId: me.id },
      orderBy: { createdAt: "desc" },
      include: { items: { include: { product: true } } },
    }),
    prisma.creditAccount.findMany({
      where: { agentId: me.id },
      include: { payments: true },
    }),
    prisma.returnRequest.count({
      where: { requesterId: me.id, status: "PENDING" },
    }),
    prisma.newsPost.findMany({
      where: { published: true },
      orderBy: { publishedAt: "desc" },
      take: 4,
    }),
    prisma.product.findMany({ where: { isActive: true }, orderBy: { price: "desc" } }),
  ]);

  // ── Order metrics ──
  const fulfilled = requests.filter((r) => r.status === "FULFILLED");
  const totalOrders = requests.length;
  const pendingApproval = requests.filter((r) =>
    ["PENDING", "PRICED"].includes(r.status),
  ).length;
  const inTransit = requests.filter((r) => r.status === "IN_TRANSIT").length;
  const delivered = fulfilled.length;
  const totalValue = fulfilled.reduce((s, r) => s + (r.totalAmount ?? 0), 0);
  const unitsPurchased = fulfilled.reduce(
    (s, r) => s + r.items.reduce((a, i) => a + i.quantity, 0),
    0,
  );

  // ── Credit / payments ──
  const open = credits.filter((c) => c.status !== "SETTLED");
  const outstanding = open.reduce((s, c) => s + (c.principal - c.amountPaid), 0);
  const totalPaid = credits.reduce((s, c) => s + c.amountPaid, 0);
  const limit = me.creditLimit ?? 0;
  const available = Math.max(0, limit - outstanding);
  const utilization = limit > 0 ? Math.round((outstanding / limit) * 100) : 0;
  const startMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const paidThisMonth = credits.reduce(
    (s, c) =>
      s +
      c.payments
        .filter((p) => p.createdAt >= startMonth)
        .reduce((a, p) => a + p.amount, 0),
    0,
  );
  const dueSoon = open
    .filter((c) => c.dueDate)
    .sort((a, b) => (a.dueDate!.getTime() - b.dueDate!.getTime()))[0];

  // ── Monthly trend (last 6 months) ──
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString("en-GB", { month: "short" }),
      value: 0,
    };
  });
  const mIdx = new Map(months.map((m, i) => [m.key, i]));
  for (const r of fulfilled) {
    const d = r.fulfilledAt ?? r.createdAt;
    const idx = mIdx.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (idx != null) months[idx].value += r.totalAmount ?? 0;
  }
  const avgMonthly = Math.round(months.reduce((s, m) => s + m.value, 0) / 6);

  // ── Stock held + product distribution ──
  type Held = {
    units: number;
    last: Date | null;
    credit: number;
  };
  const held = new Map<string, Held>();
  for (const r of fulfilled) {
    for (const it of r.items) {
      const cur = held.get(it.productId) ?? { units: 0, last: null, credit: 0 };
      cur.units += it.quantity;
      if (r.paymentType === "CREDIT") cur.credit += it.quantity;
      const d = r.deliveredAt ?? r.fulfilledAt ?? r.createdAt;
      if (!cur.last || d > cur.last) {
        cur.last = d;
      }
      held.set(it.productId, cur);
    }
  }
  const distribution = products
    .map((p) => ({
      label: productMeta(p.sku).color || p.name,
      value: held.get(p.id)?.units ?? 0,
      color: productMeta(p.sku).accent,
    }))
    .filter((s) => s.value > 0);

  const overview = [
    { label: "Total orders", value: formatNumber(totalOrders), icon: ClipboardList, accent: "primary" as const },
    { label: "Pending approval", value: formatNumber(pendingApproval), icon: Clock, accent: "warning" as const },
    { label: "In transit", value: formatNumber(inTransit), icon: Truck, accent: "accent" as const },
    { label: "Delivered", value: formatNumber(delivered), icon: PackageCheck, accent: "success" as const },
    { label: "Total purchases", value: formatCurrency(totalValue), icon: ShoppingCart, accent: "primary" as const },
    { label: "Outstanding", value: formatCurrency(outstanding), icon: CreditCard, accent: "warning" as const },
    { label: "Available credit", value: formatCurrency(available), icon: Wallet, accent: "success" as const },
    { label: "Units purchased", value: formatNumber(unitsPurchased), icon: Boxes, accent: "info" as const },
  ];

  const pendingActions = [
    { label: "Awaiting ORA review", count: pendingApproval, href: "/partner/requests", icon: Clock, tone: "text-warning" },
    { label: "In transit to you", count: inTransit, href: "/partner/requests", icon: Truck, tone: "text-accent" },
    { label: "Outstanding payments", count: open.length, href: "/partner/credit", icon: CreditCard, tone: "text-primary" },
    { label: "Returns under review", count: pendingReturns, href: "/partner/returns", icon: Undo2, tone: "text-info" },
  ].filter((a) => a.count > 0);

  const quickActions = [
    { label: "Request stock", href: "/partner/request", icon: PlusCircle },
    { label: "Browse products", href: "/partner/catalogue", icon: Boxes },
    { label: "My orders", href: "/partner/requests", icon: FileText },
    { label: "Debt & payments", href: "/partner/credit", icon: CreditCard },
    { label: "Request a return", href: "/partner/returns", icon: Undo2 },
    { label: "Contact ORA", href: ORA_CONTACT.emailHref, icon: LifeBuoy },
  ];

  const statusVariant =
    me.status === "ACTIVE" ? "success" : me.status === "PENDING" ? "warning" : "destructive";

  return (
    <div className="space-y-8">
      {/* Header */}
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-accent/10 p-5 shadow-soft sm:p-8">
          <div className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Welcome back,</p>
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                {me.name.split(" ")[0]} 👋
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="font-medium">{me.organization ?? "Partner"}</span>
                {me.businessType && <Badge variant="accent">{me.businessType}</Badge>}
                <Badge variant={statusVariant}>{humanize(me.status)}</Badge>
                <Badge variant={outstanding > 0 ? "warning" : "success"}>
                  {outstanding > 0 ? "Credit in use" : "Good standing"}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Partner since{" "}
                {me.createdAt.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
                {me.region ? ` · ${me.region}` : ""}
              </p>
            </div>
            <Link
              href="/partner/request"
              className={cn(buttonVariants({ size: "lg" }), "w-full shrink-0 rounded-full shadow-glow sm:w-auto")}
            >
              <PlusCircle className="size-5" />
              Request stock
            </Link>
          </div>
        </div>
      </Reveal>

      {/* Overview cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overview.map((o, i) => (
          <Reveal key={o.label} delay={i * 0.04}>
            <StatCard label={o.label} value={o.value} icon={o.icon} accent={o.accent} />
          </Reveal>
        ))}
      </div>

      {/* Orders + trend / credit + actions */}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {/* Recent orders */}
          <Reveal>
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="font-display text-lg font-semibold">Recent orders</h2>
                <Link href="/partner/requests" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  View all <ArrowRight className="size-4" />
                </Link>
              </div>
              {requests.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No orders yet — request stock to get started.</p>
              ) : (
                <>
                  {/* Mobile: stacked cards */}
                  <div className="sm:hidden">
                    {requests.slice(0, 6).map((r) => (
                      <Link
                        key={r.id}
                        href={`/partner/requests/${r.id}`}
                        className="flex flex-col gap-2 border-b border-border p-4 transition-colors last:border-0 active:bg-muted/50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{r.code}</span>
                          <StatusBadge status={r.status} />
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
                          <span className="text-muted-foreground">
                            {r.items.reduce((a, i) => a + i.quantity, 0)} units ·{" "}
                            {timeAgo(r.createdAt)}
                          </span>
                          <span className="flex items-center gap-2">
                            <Badge variant={r.paymentType === "CREDIT" ? "accent" : "secondary"}>
                              {humanize(r.paymentType)}
                            </Badge>
                            <span className="font-semibold">
                              {r.totalAmount != null ? formatCurrency(r.totalAmount) : "—"}
                            </span>
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>

                  {/* Desktop: table */}
                  <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-5 py-3 font-medium">Order</th>
                        <th className="px-4 py-3 font-medium">Products</th>
                        <th className="px-4 py-3 text-right font-medium">Amount</th>
                        <th className="px-4 py-3 font-medium">Payment</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-2 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {requests.slice(0, 6).map((r) => (
                        <tr key={r.id} className="border-b border-border/70 transition-colors last:border-0 hover:bg-muted/40">
                          <td className="px-5 py-3">
                            <Link href={`/partner/requests/${r.id}`} className="block">
                              <span className="font-semibold">{r.code}</span>
                              <span className="block text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>
                            </Link>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                            {r.items.reduce((a, i) => a + i.quantity, 0)} units · {r.items.length} line{r.items.length === 1 ? "" : "s"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                            {r.totalAmount != null ? formatCurrency(r.totalAmount) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={r.paymentType === "CREDIT" ? "accent" : "secondary"}>
                              {humanize(r.paymentType)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                          <td className="px-2 py-3">
                            <Link href={`/partner/requests/${r.id}`} className="text-muted-foreground hover:text-foreground">
                              <ChevronRight className="size-4" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </>
              )}
            </div>
          </Reveal>

          {/* Monthly trend */}
          <Reveal delay={0.05}>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">Purchase trend</h2>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <TrendingUp className="size-3.5" />
                  avg {formatCurrency(avgMonthly)}/mo
                </span>
              </div>
              <BarChart
                className="mt-4"
                showValues={false}
                data={months.map((m) => ({ label: m.label, value: m.value }))}
              />
            </div>
          </Reveal>
        </div>

        <div className="space-y-6">
          {/* Credit overview */}
          <Reveal>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <h2 className="font-display text-lg font-semibold">Credit & payments</h2>
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Credit utilization</span>
                  <span className="font-semibold">{utilization}%</span>
                </div>
                <Progress
                  value={utilization}
                  className="mt-2"
                  indicatorClassName={cn(
                    utilization >= 90 ? "bg-destructive" : utilization >= 70 ? "bg-warning" : "bg-success",
                  )}
                />
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>{formatCurrency(outstanding)} used</span>
                  <span>{formatCurrency(limit)} limit</span>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <Mini label="Available" value={formatCurrency(available)} accent="text-success" />
                <Mini label="Outstanding" value={formatCurrency(outstanding)} />
                <Mini label="Paid this month" value={formatCurrency(paidThisMonth)} />
                <Mini label="Total paid" value={formatCurrency(totalPaid)} />
              </div>
              {dueSoon?.dueDate && (
                <p className="mt-4 flex items-center gap-2 rounded-lg bg-warning/10 p-2.5 text-xs text-warning">
                  <AlertCircle className="size-3.5" />
                  Next payment due {dueSoon.dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </p>
              )}
              <Link href="/partner/credit" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4 w-full")}>
                Debt & payments
              </Link>
            </div>
          </Reveal>

          {/* Pending actions */}
          {pendingActions.length > 0 && (
            <Reveal delay={0.05}>
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <h2 className="font-display text-lg font-semibold">Needs attention</h2>
                <div className="mt-3 space-y-2">
                  {pendingActions.map((a) => (
                    <Link
                      key={a.label}
                      href={a.href}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-muted/40"
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <a.icon className={cn("size-4", a.tone)} />
                        {a.label}
                      </span>
                      <Badge variant="secondary">{a.count}</Badge>
                    </Link>
                  ))}
                </div>
              </div>
            </Reveal>
          )}
        </div>
      </div>

      {/* Stock held */}
      <Reveal>
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">Stock you&apos;re holding</h2>
          <p className="text-sm text-muted-foreground">Units delivered to you, by product.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {products.map((p) => {
              const m = productMeta(p.sku);
              const h = held.get(p.id);
              return (
                <div key={p.id} className="flex gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-xl ring-1 ring-border" style={{ background: `${m.accent}14` }}>
                    <Image src={m.image} alt={p.name} fill sizes="80px" className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: m.accent }}>
                        {m.size}
                      </span>
                      <span className="font-semibold">{m.color}</span>
                    </div>
                    <p className="mt-1 font-display text-2xl font-bold">{formatNumber(h?.units ?? 0)}</p>
                    <p className="text-xs text-muted-foreground">units held</p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      {h?.credit ? <span>{h.credit} on credit</span> : null}
                      {h?.last ? <span>· restocked {timeAgo(h.last)}</span> : <span>none yet</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* Distribution + ORA updates */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Reveal>
          <div className="h-full rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h2 className="font-display text-lg font-semibold">Product mix</h2>
            <p className="text-sm text-muted-foreground">Your delivered units by size.</p>
            <div className="mt-5">
              {distribution.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No delivered units yet.</p>
              ) : (
                <DonutChart
                  segments={distribution}
                  centerLabel="units"
                  centervalue={formatNumber(unitsPurchased)}
                />
              )}
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="h-full rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">ORA updates</h2>
              <Link href="/news" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                All news <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {news.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No updates yet.</p>
              ) : (
                news.map((n) => (
                  <Link
                    key={n.id}
                    href={`/news/${n.slug}`}
                    className="flex items-start gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-muted/40"
                  >
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Newspaper className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {humanize(n.category)} ·{" "}
                        {n.publishedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </Reveal>
      </div>

      {/* Quick actions */}
      <Reveal>
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">Quick actions</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {quickActions.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="glass-card glow-hover flex flex-col items-center gap-2 rounded-2xl p-5 text-center text-sm font-medium transition-transform hover:-translate-y-0.5"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-glow">
                  <a.icon className="size-5" />
                </span>
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      </Reveal>
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-semibold", accent)}>{value}</p>
    </div>
  );
}
