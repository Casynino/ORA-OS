import Link from "next/link";
import {
  Package,
  Boxes,
  Truck,
  PackagePlus,
  Undo2,
  ArrowLeftRight,
  ClipboardList,
  CheckCircle2,
  ArrowDownToLine,
  Clock,
  Users,
  Activity as ActivityIcon,
  ClipboardCheck,
  ChevronRight,
} from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Reveal } from "@/components/ui/reveal";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { formatNumber, humanize, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MOVE_LABEL: Record<string, string> = {
  ASSIGNED: "Reserved for order",
  DISTRIBUTED: "Dispatched to partner",
  RESTOCKED: "Returned to warehouse",
  INBOUND: "Stock received",
  ADJUSTMENT: "Stock adjusted",
};

export default async function WarehouseOverviewPage() {
  const session = await requireRole("WAREHOUSE");
  const me = await prisma.user.findUnique({
    where: { id: session.id },
    include: { warehouse: true },
  });

  if (!me?.warehouse) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={Package}
          title="No warehouse assigned"
          description="Your account isn't linked to a warehouse yet. Ask an ORA admin to assign you to one."
        />
      </div>
    );
  }

  const wh = me.warehouse;
  const whName = wh.name;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    stock,
    orders,
    pendingRepRequests,
    awaitingPickup,
    transfersIn,
    returns,
    receivedTodayAgg,
    movements,
    transfers,
  ] = await Promise.all([
    prisma.warehouseStock.findMany({
      where: { warehouseId: wh.id },
      include: { product: { select: { name: true, unitsPerCarton: true } } },
      orderBy: { onHand: "asc" },
    }),
    prisma.request.findMany({
      where: {
        warehouseName: whName,
        status: { in: ["APPROVED", "IN_TRANSIT", "FULFILLED"] },
        // Only payment-cleared orders ever reach the warehouse view.
        paymentStatus: { in: ["PAID", "OUTSTANDING"] },
      },
      select: { id: true, status: true, fulfilledAt: true },
    }),
    // Rep requests waiting for review — any warehouse can approve.
    prisma.repStockRequest.count({ where: { status: "PENDING" } }),
    // Prepared rep requests waiting for the rep to collect here.
    prisma.repStockRequest.count({
      where: { status: "READY", warehouseId: wh.id },
    }),
    prisma.warehouseTransfer.findMany({
      where: { toId: wh.id },
      select: { status: true },
    }),
    prisma.returnRequest.findMany({
      where: { warehouseName: whName },
      select: { status: true },
    }),
    prisma.stockMovement.aggregate({
      where: {
        type: "INBOUND",
        warehouseName: whName,
        createdAt: { gte: startOfToday },
      },
      _sum: { quantity: true },
    }),
    prisma.stockMovement.findMany({
      where: { warehouseName: whName },
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.warehouseTransfer.findMany({
      where: { OR: [{ fromId: wh.id }, { toId: wh.id }] },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { from: { select: { name: true } }, to: { select: { name: true } }, items: true },
    }),
  ]);

  // Operational counts — no money anywhere.
  const lowStock = stock.filter((r) => r.onHand <= r.minLevel);
  const totalOnHand = stock.reduce((s, r) => s + r.onHand, 0);
  const totalReserved = stock.reduce((s, r) => s + r.reserved, 0);
  const toDispatch = orders.filter((o) => o.status === "APPROVED").length;
  const outForDelivery = orders.filter((o) => o.status === "IN_TRANSIT").length;
  const dispatchedToday = orders.filter(
    (o) => o.status === "FULFILLED" && o.fulfilledAt && o.fulfilledAt >= startOfToday,
  ).length;
  const incomingTransfers = transfersIn.filter((t) => t.status === "IN_TRANSIT").length;
  const returnsToInspect = returns.filter((r) => r.status === "IN_TRANSIT").length;
  const receivedToday = receivedTodayAgg._sum.quantity ?? 0;

  const tiles = [
    { label: "Pending rep requests", count: pendingRepRequests, href: "/warehouse/rep-requests", icon: ClipboardList, accent: "warning" as const },
    { label: "Awaiting rep pickup", count: awaitingPickup, href: "/warehouse/rep-requests", icon: Clock, accent: "info" as const },
    { label: "Partner orders to dispatch", count: toDispatch, href: "/warehouse/orders", icon: Truck, accent: "warning" as const },
    { label: "Out for delivery", count: outForDelivery, href: "/warehouse/orders", icon: ClipboardList, accent: "info" as const },
    { label: "Returns to inspect", count: returnsToInspect, href: "/warehouse/returns", icon: Undo2, accent: "warning" as const },
    { label: "Incoming transfers", count: incomingTransfers, href: "/warehouse/transfers", icon: ArrowDownToLine, accent: "info" as const },
    { label: "Received today", count: receivedToday, href: "/warehouse/receive", icon: PackagePlus, accent: "success" as const },
    { label: "Dispatched today", count: dispatchedToday, href: "/warehouse/orders", icon: CheckCircle2, accent: "success" as const },
  ];

  const tasks = [
    { label: "Rep requests to review", count: pendingRepRequests, href: "/warehouse/rep-requests", icon: ClipboardList },
    { label: "Reps awaiting pickup", count: awaitingPickup, href: "/warehouse/rep-requests", icon: Users },
    { label: "Orders to dispatch", count: toDispatch, href: "/warehouse/orders", icon: Truck },
    { label: "Orders out for delivery", count: outForDelivery, href: "/warehouse/orders", icon: ClipboardList },
    { label: "Incoming transfers to receive", count: incomingTransfers, href: "/warehouse/transfers", icon: ArrowDownToLine },
    { label: "Returns to inspect", count: returnsToInspect, href: "/warehouse/returns", icon: Undo2 },
  ].filter((t) => t.count > 0);

  // Activity feed (transfers + movements at this warehouse).
  type Entry = { id: string; label: string; sub: string; time: Date; status?: string };
  const activity: Entry[] = [
    ...transfers.map((t) => ({
      id: t.id,
      label: t.fromId === wh.id ? `Transfer out → ${t.to.name}` : `Transfer in ← ${t.from.name}`,
      sub: `${t.code} · ${t.items.reduce((s, i) => s + i.quantity, 0)} units`,
      time: t.createdAt,
      status: t.status,
    })),
    ...movements.map((m) => ({
      id: m.id,
      label: MOVE_LABEL[m.type] ?? humanize(m.type),
      sub: `${m.product.name} · ${formatNumber(m.quantity)} · ${m.createdBy.name}`,
      time: m.createdAt,
    })),
  ]
    .sort((a, b) => b.time.getTime() - a.time.getTime())
    .slice(0, 8);

  // Greeting based on Tanzania time (EAT, UTC+3).
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

  const naturalList = (items: string[]) =>
    items.length <= 1
      ? items[0] ?? ""
      : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

  const work: string[] = [];
  if (pendingRepRequests) work.push(`${pendingRepRequests} rep request${pendingRepRequests > 1 ? "s" : ""} to review`);
  if (toDispatch) work.push(`${toDispatch} order${toDispatch > 1 ? "s" : ""} to dispatch`);
  if (awaitingPickup) work.push(`${awaitingPickup} pickup${awaitingPickup > 1 ? "s" : ""} waiting`);
  if (returnsToInspect) work.push(`${returnsToInspect} return${returnsToInspect > 1 ? "s" : ""} to inspect`);

  let summary: string;
  if (work.length > 0) {
    summary = `You've got ${naturalList(work)} to keep moving today.`;
    if (dispatchedToday > 0) summary += ` ${dispatchedToday} already dispatched — nice work.`;
  } else if (lowStock.length > 0) {
    summary = `All clear on orders. Keep an eye on ${lowStock.length} item${lowStock.length > 1 ? "s" : ""} running low.`;
  } else {
    summary = "You're all caught up — the warehouse is running clean.";
  }

  return (
    <div className="space-y-7">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-accent to-primary p-5 text-white shadow-glow sm:p-8">
          <div className="absolute inset-0 bg-grid opacity-20" />
          <div className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-white/15 blur-3xl animate-float-slow" />
          <div className="pointer-events-none absolute -bottom-20 right-1/3 size-48 rounded-full bg-white/10 blur-3xl animate-float-slow-rev" />
          <div className="pointer-events-none absolute -left-12 top-1/2 size-40 rounded-full bg-accent/30 blur-3xl animate-float-slow" />
          <div className="relative min-w-0">
            <p className="flex items-center gap-2 text-xs text-white/80 sm:text-sm">
              <span className="inline-block size-2 shrink-0 animate-pulse rounded-full bg-white" />
              <span className="min-w-0 truncate">
                {whName}
                {me.position ? ` · ${me.position}` : ""}
              </span>
            </p>
            <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-balance sm:text-4xl">
              {greeting}, {me.name?.split(" ")[0] ?? "Team"}.
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/90 sm:text-base">{summary}</p>
          </div>
        </div>
      </Reveal>

      {/* Available stock — the first thing the warehouse sees on open. */}
      <Reveal>
        <Card className="glass-card">
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="flex items-center gap-2">
              <Boxes className="size-4" /> Available stock
            </CardTitle>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/warehouse/receive"
                className={cn(buttonVariants({ size: "sm", variant: "outline" }), "rounded-full")}
              >
                <PackagePlus className="size-3.5" /> Receive
              </Link>
              <Link
                href="/warehouse/inventory"
                className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "rounded-full")}
              >
                Full inventory <ChevronRight className="size-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {stock.length === 0 ? (
              <EmptyState icon={Boxes} title="No stock yet" description="Receive stock to get started." />
            ) : (
              <>
                <p className="mb-3 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{formatNumber(totalOnHand)}</span>{" "}
                  units on hand across {stock.length} product{stock.length > 1 ? "s" : ""}
                  {totalReserved > 0 && <> · {formatNumber(totalReserved)} reserved for pickup</>}
                  {lowStock.length > 0 && (
                    <>
                      {" · "}
                      <span className="font-medium text-warning">{lowStock.length} running low</span>
                    </>
                  )}
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {stock.map((r) => {
                    const perCarton = r.product.unitsPerCarton || 24;
                    const cartons = Math.floor(r.onHand / perCarton);
                    const loose = r.onHand % perCarton;
                    const s =
                      r.onHand <= 0
                        ? { label: "Out", cls: "text-destructive", ring: "border-destructive/40" }
                        : r.onHand <= r.minLevel
                          ? { label: "Low", cls: "text-warning", ring: "border-warning/40" }
                          : { label: "In stock", cls: "text-success", ring: "border-border" };
                    return (
                      <div key={r.id} className={cn("rounded-xl border p-3", s.ring)}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-tight">{r.product.name}</p>
                          <span className={cn("shrink-0 text-[10px] font-semibold uppercase", s.cls)}>
                            {s.label}
                          </span>
                        </div>
                        <p className="mt-2 font-display text-2xl font-bold leading-none">
                          {formatNumber(cartons)}
                          <span className="ml-1 text-sm font-medium text-muted-foreground">cartons</span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatNumber(r.onHand)} pcs
                          {loose ? ` · ${formatNumber(loose)} loose` : ""}
                          {r.reserved > 0 ? ` · ${formatNumber(r.reserved)} reserved` : ""}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </Reveal>

      {/* Operational KPIs — counts only, never money. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="transition-transform hover:-translate-y-0.5">
            <StatCard label={t.label} value={formatNumber(t.count)} icon={t.icon} accent={t.accent} />
          </Link>
        ))}
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* Today's tasks + quick actions */}
        <div className="space-y-6">
          <Reveal>
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="size-4" /> Today&apos;s tasks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {tasks.length === 0 ? (
                  <EmptyState icon={CheckCircle2} title="All clear" description="No tasks waiting right now." />
                ) : (
                  tasks.map((t) => (
                    <Link
                      key={t.label}
                      href={t.href}
                      className="flex items-center justify-between rounded-lg border border-border/60 p-3 transition hover:bg-muted/40"
                    >
                      <span className="inline-flex items-center gap-2.5 text-sm font-medium">
                        <t.icon className="size-4 text-muted-foreground" />
                        {t.label}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                          {t.count}
                        </span>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </span>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </Reveal>

          <Reveal delay={0.08}>
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Quick actions</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2.5 sm:grid-cols-2">
                <Link href="/warehouse/rep-requests" className={buttonVariants()}>
                  <ClipboardList className="size-4" /> Rep requests
                </Link>
                <Link href="/warehouse/orders" className={cn(buttonVariants({ variant: "outline" }))}>
                  <Truck className="size-4" /> Partner orders
                </Link>
                <Link href="/warehouse/receive" className={cn(buttonVariants({ variant: "outline" }))}>
                  <PackagePlus className="size-4" /> Receive stock
                </Link>
                <Link href="/warehouse/transfers" className={cn(buttonVariants({ variant: "outline" }))}>
                  <ArrowLeftRight className="size-4" /> Transfers
                </Link>
                <Link href="/warehouse/returns" className={cn(buttonVariants({ variant: "outline" }))}>
                  <Undo2 className="size-4" /> Returns
                </Link>
                <Link href="/warehouse/inventory" className={cn(buttonVariants({ variant: "outline" }))}>
                  <Boxes className="size-4" /> Inventory
                </Link>
              </CardContent>
            </Card>
          </Reveal>
        </div>

        {/* Recent activity */}
        <Reveal delay={0.12}>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ActivityIcon className="size-4" /> Recent activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <EmptyState icon={Boxes} title="No activity yet" description="Stock movements will show here." />
              ) : (
                <ol className="relative space-y-4 pl-5">
                  <span className="absolute left-[5px] top-1 h-[calc(100%-0.5rem)] w-px bg-border" />
                  {activity.map((e) => (
                    <li key={e.id} className="relative">
                      <span className="absolute -left-5 top-1 size-2.5 rounded-full bg-primary/70" />
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{e.label}</p>
                          <p className="text-xs text-muted-foreground">{e.sub}</p>
                          <p className="text-[11px] text-muted-foreground">{timeAgo(e.time)}</p>
                        </div>
                        {e.status && <StatusBadge status={e.status} className="shrink-0" />}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </Reveal>
      </div>

    </div>
  );
}
