import Link from "next/link";
import {
  BadgeCheck,
  TrendingUp,
  CreditCard,
  Gift,
  Package,
  ChevronRight,
  Trophy,
  ClipboardList,
} from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getRepsPerformance } from "@/lib/services/field";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FulfillRequestButton, RejectStockRequestButton } from "@/components/admin/rep-controls";
import { formatCurrency, formatNumber, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminRepsPage() {
  await requireRole("ADMIN");

  const [rows, pendingRequests, inventories] = await Promise.all([
    getRepsPerformance(),
    prisma.repStockRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: {
        rep: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, unitsPerCarton: true } },
          },
        },
      },
    }),
    prisma.inventory.findMany({
      include: { product: { select: { id: true, name: true, isActive: true } } },
    }),
  ]);

  const productOpts = inventories
    .filter((i) => i.product.isActive)
    .map((i) => ({ id: i.productId, name: i.product.name, available: i.warehouseQty }));

  // Warehouse availability per product — used to warn/limit at fulfilment time.
  const availableById = new Map(inventories.map((i) => [i.productId, i.warehouseQty]));

  const totals = {
    sales: rows.reduce((s, r) => s + r.salesMonth, 0),
    credit: rows.reduce((s, r) => s + r.creditOutstanding, 0),
    stock: rows.reduce((s, r) => s + r.stockInHand, 0),
    samples: rows.reduce((s, r) => s + r.samplesMonth, 0),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales reps"
        description="Field team performance, stock in their hands and credit exposure — live."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Field sales this month" value={formatCurrency(totals.sales)} icon={TrendingUp} accent="primary" />
        <StatCard label="Credit exposure" value={formatCurrency(totals.credit)} icon={CreditCard} accent="warning" />
        <StatCard label="Stock in the field" value={formatNumber(totals.stock)} icon={Package} accent="info" hint="units with reps" />
        <StatCard label="Samples this month" value={formatNumber(totals.samples)} icon={Gift} accent="accent" />
      </div>

      {/* Pending stock requests */}
      {pendingRequests.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
            <ClipboardList className="size-5 text-warning" />
            Stock requests awaiting you
          </h2>
          <div className="space-y-2">
            {pendingRequests.map((r) => (
              <div key={r.id} className="rounded-2xl border border-warning/30 bg-warning/[0.04] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {r.rep.name} · {r.items.length} product{r.items.length === 1 ? "" : "s"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.code}
                      {r.note ? ` · "${r.note}"` : ""} · {timeAgo(r.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <FulfillRequestButton
                      requestId={r.id}
                      repName={r.rep.name}
                      items={r.items.map((it) => ({
                        productId: it.productId,
                        productName: it.product.name,
                        unitsPerCarton: it.product.unitsPerCarton,
                        requested: it.quantity,
                        available: availableById.get(it.productId) ?? 0,
                        isSample: it.kind === "SAMPLE",
                      }))}
                    />
                    <RejectStockRequestButton id={r.id} />
                  </div>
                </div>
                <ul className="mt-2.5 space-y-1 border-t border-warning/20 pt-2.5">
                  {r.items.map((it) => {
                    const cartons = Math.floor(it.quantity / it.product.unitsPerCarton);
                    const loose = it.quantity % it.product.unitsPerCarton;
                    const avail = availableById.get(it.productId) ?? 0;
                    const short = avail < it.quantity;
                    return (
                      <li key={it.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">
                          {it.product.name}
                          {it.kind === "SAMPLE" && (
                            <span className="ml-1.5 text-xs text-muted-foreground">(sample)</span>
                          )}
                        </span>
                        <span className={`shrink-0 text-right ${short ? "text-destructive" : ""}`}>
                          <span className="font-medium">{formatNumber(it.quantity)} pcs</span>
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({formatNumber(cartons)} ctn{loose ? ` +${formatNumber(loose)}` : ""})
                          </span>
                          {short && (
                            <span className="ml-1 text-xs">· only {formatNumber(avail)} in stock</span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Ranking */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">
          Performance ranking — this month
        </h2>
        {rows.length === 0 ? (
          <EmptyState
            className="rounded-2xl border border-dashed border-border py-12"
            icon={BadgeCheck}
            title="No sales reps yet"
            description='Create one from Users → "Create user" with the Sales rep role.'
          />
        ) : (
          <div className="space-y-2">
            {rows.map((r, i) => (
              <Link
                key={r.id}
                href={`/admin/reps/${r.id}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <span
                  className={
                    "flex size-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold " +
                    (i === 0
                      ? "bg-warning/15 text-warning"
                      : "bg-muted text-muted-foreground")
                  }
                >
                  {i === 0 ? <Trophy className="size-4" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold">{r.name}</p>
                    <StatusBadge status={r.status} />
                    {r.region && <Badge variant="secondary">{r.region}</Badge>}
                    {r.overdue > 0 && <Badge variant="destructive">{r.overdue} overdue</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatNumber(r.unitsMonth)} units · stock {formatNumber(r.stockInHand)} ·
                    samples {formatNumber(r.samplesMonth)} · {r.reportsMonth} reports
                    {r.lastReportAt ? ` (last ${timeAgo(r.lastReportAt)})` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display font-bold">{formatCurrency(r.salesMonth)}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.salesTarget > 0
                      ? `${Math.min(100, Math.round((r.salesMonth / r.salesTarget) * 100))}% of target`
                      : "no target"}
                    {r.creditOutstanding > 0 && (
                      <span className="text-warning"> · owed {formatCurrency(r.creditOutstanding)}</span>
                    )}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
