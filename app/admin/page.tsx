import Link from "next/link";
import {
  Package,
  Users,
  Wallet,
  Star,
  Clock,
  TrendingUp,
  HeartHandshake,
  ClipboardList,
  Undo2,
  UserCheck,
  ArrowRight,
  Boxes,
  Truck,
  Lock,
  CheckCircle2,
  CircleDot,
  Warehouse as WIcon,
  ArrowLeftRight,
  AlertTriangle,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { getAdminOverview } from "@/lib/stats";
import { getWarehouseSummaries } from "@/lib/warehouse-data";
import { KpiCard } from "@/components/admin/kpi-card";
import { Reveal } from "@/components/ui/reveal";
import { StatusBadge } from "@/components/ui/status-badge";
import { DonutChart } from "@/components/ui/charts";
import { QueueApprove } from "@/components/admin/queue-approve";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatNumber, timeAgo } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "hsl(38 95% 60%)",
  PRICED: "hsl(217 91% 60%)",
  APPROVED: "hsl(145 65% 52%)",
  FULFILLED: "hsl(322 100% 65%)",
  REJECTED: "hsl(0 75% 60%)",
  CANCELLED: "hsl(280 6% 55%)",
};

export default async function AdminCommandCenter() {
  const admin = await requireRole("ADMIN");
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startMonth = new Date();
  startMonth.setDate(1);
  startMonth.setHours(0, 0, 0, 0);

  const [
    overview,
    donationsAgg,
    pendingRequests,
    pendingReturns,
    pendingApplications,
    approved,
    salesToday,
    salesMonth,
    bestSeller,
    reservedAgg,
    lockedAgg,
    recentActivity,
    statusGroups,
  ] = await Promise.all([
    getAdminOverview(),
    prisma.donation.aggregate({ _sum: { amount: true } }),
    prisma.request.findMany({
      where: { status: { in: ["PENDING", "PRICED"] } },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { requester: true, items: true },
    }),
    prisma.returnRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 4,
      include: { product: true, requester: true },
    }),
    prisma.user.findMany({
      where: { role: "PARTNER", status: "PENDING" },
      take: 4,
    }),
    prisma.request.findMany({
      where: { status: { in: ["APPROVED", "IN_TRANSIT"] } },
      include: { requester: true, items: true },
    }),
    prisma.request.aggregate({
      _sum: { totalAmount: true },
      _count: true,
      where: { status: "FULFILLED", fulfilledAt: { gte: startToday } },
    }),
    prisma.request.aggregate({
      _sum: { totalAmount: true },
      _count: true,
      where: { status: "FULFILLED", fulfilledAt: { gte: startMonth } },
    }),
    prisma.inventory.findFirst({
      orderBy: { distributedQty: "desc" },
      include: { product: true },
    }),
    prisma.requestItem.aggregate({
      _sum: { quantity: true },
      where: { request: { status: { in: ["PENDING", "PRICED"] } } },
    }),
    prisma.returnRequest.aggregate({
      _sum: { quantity: true },
      where: { status: "PENDING" },
    }),
    prisma.activityLog.findMany({ take: 6, orderBy: { createdAt: "desc" } }),
    prisma.request.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  // Partner stock visibility — units committed per partner.
  const byPartner = new Map<string, { name: string; org: string | null; units: number }>();
  for (const r of approved) {
    const units = r.items.reduce((s, i) => s + i.quantity, 0);
    const cur = byPartner.get(r.requesterId) ?? {
      name: r.requester.name,
      org: r.requester.organization,
      units: 0,
    };
    cur.units += units;
    byPartner.set(r.requesterId, cur);
  }
  const partnerStock = [...byPartner.values()].sort((a, b) => b.units - a.units);
  const withPartners = partnerStock.reduce((s, p) => s + p.units, 0);

  const available = overview.stock.warehouse;
  const reserved = reservedAgg._sum.quantity ?? 0;
  const inTransit = overview.stock.assigned;
  const locked = lockedAgg._sum.quantity ?? 0;
  const stockBuckets = [
    { label: "Available", value: available, color: "hsl(145 65% 52%)" },
    { label: "Reserved", value: reserved, color: "hsl(38 95% 60%)" },
    { label: "In-transit", value: inTransit, color: "hsl(251 100% 72%)" },
    { label: "Locked", value: locked, color: "hsl(0 75% 60%)" },
  ];
  const stockTotal = stockBuckets.reduce((s, b) => s + b.value, 0) || 1;

  const pendingTotal =
    overview.pendingRequests + overview.pendingReturns + overview.pendingAgents;

  // Greeting + date based on Tanzania time (EAT, UTC+3).
  const eatHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Dar_es_Salaam",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
  const greeting =
    eatHour >= 5 && eatHour < 12
      ? "Good morning"
      : eatHour >= 12 && eatHour < 17
        ? "Good afternoon"
        : "Good evening";
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Dar_es_Salaam",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const donut = statusGroups.map((g) => ({
    label: g.status,
    value: g._count._all,
    color: STATUS_COLORS[g.status] ?? "hsl(280 6% 55%)",
  }));
  const totalReq = donut.reduce((s, d) => s + d.value, 0);

  // Warehouse network (global view)
  const [warehouseSummaries, whValueRows, transfersInProgress] = await Promise.all([
    getWarehouseSummaries(),
    prisma.warehouseStock.findMany({
      select: { warehouseId: true, onHand: true, product: { select: { price: true } } },
    }),
    prisma.warehouseTransfer.count({
      where: { status: { in: ["PENDING", "APPROVED", "IN_TRANSIT"] } },
    }),
  ]);
  const valueByWh = new Map<string, number>();
  for (const r of whValueRows) {
    valueByWh.set(r.warehouseId, (valueByWh.get(r.warehouseId) ?? 0) + r.onHand * r.product.price);
  }
  const networkLowStock = warehouseSummaries.reduce((s, w) => s + w.lowStock, 0);
  const networkValue = [...valueByWh.values()].reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-7">
      {/* Welcome */}
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-accent to-primary p-6 text-white shadow-glow sm:p-8">
          <div className="absolute inset-0 bg-grid opacity-20" />
          {/* Animated decorative blobs */}
          <div className="pointer-events-none absolute -right-12 -top-16 size-56 rounded-full bg-white/15 blur-3xl animate-float-slow" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 size-48 rounded-full bg-white/10 blur-3xl animate-float-slow-rev" />
          <div className="pointer-events-none absolute -left-12 top-1/2 size-40 rounded-full bg-accent/30 blur-3xl animate-float-slow" />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="flex items-center gap-2 text-sm text-white/80">
                <span className="inline-block size-2 animate-pulse rounded-full bg-white" />
                {dateLabel} · Live control center
              </p>
              <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                {greeting}.
              </h1>
              <p className="mt-2 text-white/90">
                Here&apos;s what&apos;s happening across ORA today.
              </p>
            </div>
            <div className="flex gap-8">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/70">Sales today</p>
                <p className="font-display text-2xl font-bold">{formatCurrency(salesToday._sum.totalAmount ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-white/70">This month</p>
                <p className="font-display text-2xl font-bold">{formatCurrency(salesMonth._sum.totalAmount ?? 0)}</p>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* The answers */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          The answers
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Reveal><KpiCard label="Stock I have" value={available} suffix=" units" icon={Package} accent="primary" hint={`${formatNumber(overview.stock.distributed)} distributed`} /></Reveal>
          <Reveal delay={0.05}><KpiCard label="With partners" value={withPartners} suffix=" units" icon={Users} accent="info" hint={`${partnerStock.length} holding`} /></Reveal>
          <Reveal delay={0.1}><KpiCard label="Owed to me" value={overview.creditOutstanding} prefix="TSh " icon={Wallet} accent="warning" /></Reveal>
          <Reveal delay={0.15}>
            <div className="glass-card relative overflow-hidden rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Best seller</span>
                <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-warning/25 to-warning/5 text-warning"><Star className="size-4" /></span>
              </div>
              <p className="mt-3 truncate font-display text-lg font-bold tracking-tight">{bestSeller?.product.name ?? "—"}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{formatNumber(bestSeller?.distributedQty ?? 0)} distributed</p>
            </div>
          </Reveal>
          <Reveal delay={0.2}>
            <Link href="#queue" className="block">
              <KpiCard label="Pending approvals" value={pendingTotal} icon={Clock} accent="accent" hint="awaiting your sign-off" />
            </Link>
          </Reveal>
        </div>
      </div>

      {/* Financial row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Reveal><KpiCard label="Sales today" value={salesToday._sum.totalAmount ?? 0} prefix="TSh " icon={TrendingUp} accent="success" hint={`${salesToday._count} orders`} /></Reveal>
        <Reveal delay={0.05}><KpiCard label="Sales this month" value={salesMonth._sum.totalAmount ?? 0} prefix="TSh " icon={TrendingUp} accent="success" hint={`${salesMonth._count} orders`} /></Reveal>
        <Reveal delay={0.1}><KpiCard label="Donations" value={donationsAgg._sum.amount ?? 0} prefix="TSh " icon={HeartHandshake} accent="accent" /></Reveal>
        <Reveal delay={0.15}><KpiCard label="Active partners" value={overview.agents} icon={Users} accent="info" hint={`${overview.pendingAgents} pending`} /></Reveal>
      </div>

      {/* Global stock overview */}
      <Reveal>
        <div className="glass-card rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold">Global stock overview</h3>
            <span className="text-sm text-muted-foreground">
              {formatNumber(stockTotal)} units tracked
            </span>
          </div>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full">
            {stockBuckets.map((b) => (
              <div key={b.label} style={{ width: `${(b.value / stockTotal) * 100}%`, background: b.color }} />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stockBuckets.map((b) => (
              <div key={b.label}>
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ background: b.color }} />
                  <span className="text-xs text-muted-foreground">{b.label}</span>
                </div>
                <p className="mt-1 font-display text-xl font-bold">{formatNumber(b.value)}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Approval queue + activity */}
      <div id="queue" className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Reveal>
          <div className="glass-card rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold">Approval queue</h3>
              <span className="flex items-center gap-1.5 text-xs font-medium text-warning">
                <CircleDot className="size-3.5" />
                {pendingTotal} waiting
              </span>
            </div>

            {pendingTotal === 0 ? (
              <EmptyState className="mt-4" icon={CheckCircle2} title="All clear" description="No actions are waiting for approval." />
            ) : (
              <div className="mt-4 space-y-2">
                {pendingRequests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="size-4 text-warning" />
                        <p className="truncate text-sm font-medium">{r.code} · {r.requester.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Stock request · {r.items.length} items · {timeAgo(r.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={r.status} />
                      <Link href="/admin/requests" className={buttonVariants({ size: "sm", variant: "outline" })}>Review</Link>
                    </div>
                  </div>
                ))}
                {pendingReturns.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Undo2 className="size-4 text-info" />
                        <p className="truncate text-sm font-medium">{r.code} · {r.product.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Return · {r.quantity} units · {r.requester.name}</p>
                    </div>
                    <QueueApprove kind="return" id={r.id} />
                  </div>
                ))}
                {pendingApplications.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <UserCheck className="size-4 text-accent" />
                        <p className="truncate text-sm font-medium">{u.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Partner application{u.organization ? ` · ${u.organization}` : ""}</p>
                    </div>
                    <QueueApprove kind="application" id={u.id} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="glass-card rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold">Live activity</h3>
              <span className="flex items-center gap-1.5 text-xs font-medium text-success">
                <span className="size-1.5 animate-pulse rounded-full bg-success" />Live
              </span>
            </div>
            <div className="mt-4 space-y-3.5">
              {recentActivity.length === 0 ? (
                <EmptyState icon={ClipboardList} title="Nothing yet" />
              ) : (
                recentActivity.map((a) => (
                  <div key={a.id} className="flex gap-3">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-gradient-to-br from-primary to-accent" />
                    <div>
                      <p className="text-sm leading-snug">{a.summary}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(a.createdAt)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Reveal>
      </div>

      {/* Partner stock + pipeline */}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Reveal>
          <div className="glass-card rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold">Stock with partners</h3>
              <Link href="/admin/users" className={buttonVariants({ variant: "ghost", size: "sm" })}>All partners <ArrowRight className="size-4" /></Link>
            </div>
            <div className="mt-4 space-y-2">
              {partnerStock.length === 0 ? (
                <EmptyState icon={Users} title="No partner-held stock" description="Approved orders show here as units held by each partner." />
              ) : (
                partnerStock.map((p) => (
                  <div key={p.name} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.org ?? "Partner"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${Math.min(100, (p.units / (partnerStock[0].units || 1)) * 100)}%` }} />
                      </div>
                      <span className="font-display font-semibold">{formatNumber(p.units)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="glass-card rounded-2xl p-5 sm:p-6">
            <h3 className="font-display font-semibold">Request pipeline</h3>
            <div className="mt-4">
              {totalReq > 0 ? (
                <DonutChart segments={donut} centervalue={formatNumber(totalReq)} centerLabel="requests" />
              ) : (
                <EmptyState icon={ClipboardList} title="No requests yet" />
              )}
            </div>
          </div>
        </Reveal>
      </div>

      {/* Warehouse network — global view */}
      <Reveal>
        <div className="glass-card rounded-2xl p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 font-display font-semibold">
              <WIcon className="size-4" /> Warehouse network
            </h3>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Boxes className="size-3.5" /> {formatCurrency(networkValue)} value
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ArrowLeftRight className="size-3.5" /> {transfersInProgress} transfers in progress
              </span>
              <span className={`inline-flex items-center gap-1.5 ${networkLowStock > 0 ? "text-warning" : ""}`}>
                <AlertTriangle className="size-3.5" /> {networkLowStock} low-stock
              </span>
              <Link href="/admin/warehouses" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Manage <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {warehouseSummaries.map((w) => (
              <Link
                key={w.id}
                href={`/admin/warehouses/${w.id}`}
                className="rounded-xl border border-border/60 p-4 transition hover:border-primary/40 hover:bg-muted/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{w.name}</p>
                  <StatusBadge status={w.status} />
                </div>
                <div className="mt-2 flex items-end justify-between">
                  <span className="font-display text-xl font-semibold">
                    {formatNumber(w.onHand)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">units</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(valueByWh.get(w.id) ?? 0)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                    style={{ width: `${w.capacityPct}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{w.activeOrders} orders · {w.transfersIn + w.transfersOut} transfers</span>
                  {w.lowStock > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-warning">
                      <AlertTriangle className="size-3" /> {w.lowStock}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </Reveal>
    </div>
  );
}
