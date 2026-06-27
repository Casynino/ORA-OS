import Link from "next/link";
import {
  Package,
  Boxes,
  Truck,
  PackagePlus,
  Undo2,
  ArrowLeftRight,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  ArrowDownToLine,
  ArrowUpFromLine,
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
import { AreaChart, BarChart } from "@/components/ui/charts";
import { cn } from "@/lib/utils";
import { formatNumber, humanize, timeAgo } from "@/lib/utils";

const MOVE_LABEL: Record<string, string> = {
  ASSIGNED: "Reserved for order",
  DISTRIBUTED: "Dispatched to partner",
  RESTOCKED: "Returned to warehouse",
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

  const [stock, orders, transfersIn, transfersOut, returns, movements, transfers] =
    await Promise.all([
      prisma.warehouseStock.findMany({
        where: { warehouseId: wh.id },
        include: { product: { select: { name: true, sku: true } } },
        orderBy: { onHand: "asc" },
      }),
      prisma.request.findMany({
        where: {
          warehouseName: whName,
          status: { in: ["APPROVED", "IN_TRANSIT", "FULFILLED"] },
        },
        select: { id: true, status: true, fulfilledAt: true },
      }),
      prisma.warehouseTransfer.findMany({
        where: { toId: wh.id },
        select: { status: true },
      }),
      prisma.warehouseTransfer.findMany({
        where: { fromId: wh.id },
        select: { status: true },
      }),
      prisma.returnRequest.findMany({
        where: { warehouseName: whName },
        select: { status: true },
      }),
      prisma.stockMovement.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        include: { product: { select: { name: true } }, createdBy: { select: { name: true } } },
      }),
      prisma.warehouseTransfer.findMany({
        where: { OR: [{ fromId: wh.id }, { toId: wh.id }] },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { from: { select: { name: true } }, to: { select: { name: true } }, items: true },
      }),
    ]);

  const tenDaysAgo = new Date(startOfToday.getTime() - 10 * 24 * 60 * 60 * 1000);
  const [topItems, recvTransfers, recvReturns] = await Promise.all([
    prisma.requestItem.groupBy({
      by: ["productId"],
      where: {
        request: {
          warehouseName: whName,
          status: { in: ["APPROVED", "IN_TRANSIT", "FULFILLED"] },
        },
      },
      _sum: { quantity: true },
    }),
    prisma.warehouseTransfer.findMany({
      where: { toId: wh.id, status: "COMPLETED", receivedAt: { gte: tenDaysAgo } },
      select: { receivedAt: true },
    }),
    prisma.returnRequest.findMany({
      where: { warehouseName: whName, status: "COMPLETED", receivedAt: { gte: tenDaysAgo } },
      select: { receivedAt: true },
    }),
  ]);

  // Analytics
  const onHand = stock.reduce((s, r) => s + r.onHand, 0);
  const lowStock = stock.filter((r) => r.onHand <= r.minLevel);
  const toDispatch = orders.filter((o) => o.status === "APPROVED").length;
  const inTransitOrders = orders.filter((o) => o.status === "IN_TRANSIT").length;
  const deliveredToday = orders.filter(
    (o) => o.status === "FULFILLED" && o.fulfilledAt && o.fulfilledAt >= startOfToday,
  ).length;
  const incomingTransfers = transfersIn.filter((t) => t.status === "IN_TRANSIT").length;
  const outgoingToDispatch = transfersOut.filter((t) => t.status === "APPROVED").length;
  const returnsToReceive = returns.filter((r) => r.status === "IN_TRANSIT").length;
  const returnsCompleted = returns.filter((r) => r.status === "COMPLETED").length;

  const tasks = [
    { label: "Orders to dispatch", count: toDispatch, href: "/warehouse/orders", icon: Truck },
    { label: "Orders in transit", count: inTransitOrders, href: "/warehouse/orders", icon: ClipboardList },
    { label: "Incoming transfers to receive", count: incomingTransfers, href: "/warehouse/transfers", icon: ArrowDownToLine },
    { label: "Transfers awaiting dispatch", count: outgoingToDispatch, href: "/warehouse/transfers", icon: ArrowUpFromLine },
    { label: "Returns awaiting inspection", count: returnsToReceive, href: "/warehouse/returns", icon: Undo2 },
  ].filter((t) => t.count > 0);

  // Activity feed (transfers + movements)
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

  // Performance: daily dispatch trend (last 10 days) + most-moved products.
  const days = 10;
  const dispatchTrend: number[] = [];
  const receiptsTrend: number[] = [];
  const dayLabels: string[] = [];
  const receiptDates = [
    ...recvTransfers.map((t) => t.receivedAt),
    ...recvReturns.map((r) => r.receivedAt),
  ].filter((d): d is Date => !!d);
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(startOfToday.getTime() - i * 24 * 60 * 60 * 1000);
    const next = new Date(day.getTime() + 24 * 60 * 60 * 1000);
    dispatchTrend.push(
      orders.filter(
        (o) =>
          o.status === "FULFILLED" &&
          o.fulfilledAt &&
          o.fulfilledAt >= day &&
          o.fulfilledAt < next,
      ).length,
    );
    receiptsTrend.push(
      receiptDates.filter((d) => d >= day && d < next).length,
    );
    dayLabels.push(day.toLocaleDateString("en", { weekday: "short" }));
  }
  const nameByProduct = new Map(stock.map((s) => [s.productId, s.product.name]));
  const topProducts = topItems
    .map((t) => ({
      label: (nameByProduct.get(t.productId) ?? "—").replace("Ora ", ""),
      value: t._sum.quantity ?? 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);
  const hasPerf =
    dispatchTrend.some((v) => v > 0) ||
    receiptsTrend.some((v) => v > 0) ||
    topProducts.length > 0;

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

  // A warm, natural "what's happening today" summary.
  const naturalList = (items: string[]) =>
    items.length <= 1
      ? items[0] ?? ""
      : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

  const work: string[] = [];
  if (toDispatch) work.push(`${toDispatch} order${toDispatch > 1 ? "s" : ""} to dispatch`);
  if (inTransitOrders) work.push(`${inTransitOrders} order${inTransitOrders > 1 ? "s" : ""} in transit`);
  if (incomingTransfers) work.push(`${incomingTransfers} transfer${incomingTransfers > 1 ? "s" : ""} arriving`);
  if (returnsToReceive) work.push(`${returnsToReceive} return${returnsToReceive > 1 ? "s" : ""} to inspect`);

  let summary: string;
  if (work.length > 0) {
    summary = `You've got ${naturalList(work)} to keep moving today.`;
    if (deliveredToday > 0)
      summary += ` ${deliveredToday} already delivered — nice work.`;
  } else if (lowStock.length > 0) {
    summary = `Orders are all clear. Keep an eye on ${lowStock.length} item${lowStock.length > 1 ? "s" : ""} running low on stock.`;
  } else {
    summary = "You're all caught up — the warehouse is running clean.";
  }

  return (
    <div className="space-y-7">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-accent to-primary p-6 text-white shadow-glow sm:p-8">
          <div className="absolute inset-0 bg-grid opacity-20" />
          {/* Animated decorative blobs */}
          <div className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-white/15 blur-3xl animate-float-slow" />
          <div className="pointer-events-none absolute -bottom-20 right-1/3 size-48 rounded-full bg-white/10 blur-3xl animate-float-slow-rev" />
          <div className="pointer-events-none absolute -left-12 top-1/2 size-40 rounded-full bg-accent/30 blur-3xl animate-float-slow" />
          <div className="relative">
            <p className="flex items-center gap-2 text-sm text-white/80">
              <span className="inline-block size-2 animate-pulse rounded-full bg-white" />
              {whName}
              {me.position ? ` · ${me.position}` : ""}
            </p>
            <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {greeting}, {me.name?.split(" ")[0] ?? "Team"}.
            </h1>
            <p className="mt-2 max-w-2xl text-white/90">{summary}</p>
          </div>
        </div>
      </Reveal>

      {/* Analytics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Current stock" value={formatNumber(onHand)} hint={`${stock.length} products`} icon={Package} accent="primary" />
        <StatCard label="Orders to dispatch" value={formatNumber(toDispatch)} icon={Truck} accent="warning" />
        <StatCard label="In transit" value={formatNumber(inTransitOrders)} icon={ClipboardList} accent="info" />
        <StatCard label="Delivered today" value={formatNumber(deliveredToday)} icon={CheckCircle2} accent="success" />
        <StatCard label="Incoming transfers" value={formatNumber(incomingTransfers)} icon={ArrowDownToLine} accent="info" />
        <StatCard label="Outgoing transfers" value={formatNumber(outgoingToDispatch)} icon={ArrowUpFromLine} accent="info" />
        <StatCard label="Returns to inspect" value={formatNumber(returnsToReceive)} hint={`${returnsCompleted} completed`} icon={Undo2} accent="warning" />
        <StatCard label="Low stock" value={formatNumber(lowStock.length)} icon={AlertTriangle} accent={lowStock.length > 0 ? "warning" : "success"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
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
                <Link href="/warehouse/receive" className={buttonVariants()}>
                  <PackagePlus className="size-4" /> Receive stock
                </Link>
                <Link href="/warehouse/orders" className={cn(buttonVariants({ variant: "outline" }))}>
                  <Truck className="size-4" /> Fulfill orders
                </Link>
                <Link href="/warehouse/transfers" className={cn(buttonVariants({ variant: "outline" }))}>
                  <ArrowLeftRight className="size-4" /> Transfers
                </Link>
                <Link href="/warehouse/returns" className={cn(buttonVariants({ variant: "outline" }))}>
                  <Undo2 className="size-4" /> Returns
                </Link>
                {me.canRecordSales && (
                  <Link href="/warehouse/sales" className={cn(buttonVariants({ variant: "outline" }))}>
                    <Package className="size-4" /> Record sale
                  </Link>
                )}
                <Link href="/warehouse/inventory" className={cn(buttonVariants({ variant: "outline" }), me.canRecordSales ? "" : "sm:col-span-2")}>
                  <Boxes className="size-4" /> View inventory
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

      {/* Performance */}
      {hasPerf && (
        <Reveal>
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Dispatch trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <AreaChart data={dispatchTrend} />
                  <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                    {dayLabels.map((d, i) => (
                      <span key={i} className="flex-1 text-center">{d}</span>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Orders delivered per day · last {days} days
                  </p>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Receipts trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <AreaChart data={receiptsTrend} color="hsl(145 65% 52%)" />
                  <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                    {dayLabels.map((d, i) => (
                      <span key={i} className="flex-1 text-center">{d}</span>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Transfers & returns received per day · last {days} days
                  </p>
                </CardContent>
              </Card>
            </div>
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Most-moved products</CardTitle>
              </CardHeader>
              <CardContent>
                {topProducts.length === 0 ? (
                  <EmptyState icon={Boxes} title="No data yet" />
                ) : (
                  <BarChart data={topProducts} />
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Units across this warehouse&apos;s orders
                </p>
              </CardContent>
            </Card>
          </div>
        </Reveal>
      )}

      {/* Low stock */}
      {lowStock.length > 0 && (
        <Reveal>
          <Card className="glass-card border-warning/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-warning">
                <AlertTriangle className="size-4" /> Low stock alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {lowStock.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                  <span className="text-sm">{r.product.name}</span>
                  <span className="text-sm font-semibold text-warning">
                    {formatNumber(r.onHand)} / {formatNumber(r.minLevel)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </Reveal>
      )}
    </div>
  );
}
