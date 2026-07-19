import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  TrendingUp,
  CreditCard,
  Package,
  Gift,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getRepOverview } from "@/lib/services/field";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CollectForm } from "@/components/field/field-forms";
import {
  IssueStockButton,
  SetTargetsButton,
  RepStatusButton,
  TerritoryButton,
  CustomerCreditToggle,
  VoidSaleButton,
} from "@/components/admin/rep-controls";
import { cn, formatCurrency, formatNumber, formatDate, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminRepDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");
  const { id } = await params;

  const rep = await prisma.user.findUnique({ where: { id } });
  if (!rep || rep.role !== "SALES_REP") notFound();

  const [d, sales, customers, samples, reports, inventories, accounts] = await Promise.all([
    getRepOverview(id),
    prisma.fieldSale.findMany({
      where: { repId: id, isOpeningBalance: false }, // sales list — exclude migrated debt
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        customer: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
    }),
    prisma.fieldCustomer.findMany({
      where: { repId: id },
      orderBy: { name: "asc" },
      include: {
        // Owed totals exclude finance-rejected sales (PENDING stays visible).
        sales: {
          where: { voided: false, type: "CREDIT", financeStatus: { not: "REJECTED" } },
          select: { id: true, total: true, amountPaid: true, creditStatus: true },
        },
      },
    }),
    prisma.sampleLog.findMany({
      where: { repId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { product: { select: { name: true } } },
    }),
    prisma.fieldReport.findMany({
      where: { repId: id },
      orderBy: { reportDate: "desc" },
      take: 10,
    }),
    prisma.inventory.findMany({
      include: { product: { select: { id: true, name: true, isActive: true } } },
    }),
    prisma.paymentAccount.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, accountName: true, accountNumber: true },
    }),
  ]);

  const productOpts = inventories
    .filter((i) => i.product.isActive)
    .map((i) => ({ id: i.productId, name: i.product.name, available: i.warehouseQty }));

  const t = d.target;
  const targetRows = t
    ? [
        { label: "Sales", done: d.salesMonth, goal: t.salesTarget, money: true },
        { label: "Units", done: d.unitsMonth, goal: t.unitsTarget, money: false },
        { label: "Cash collected", done: d.cashCollectedMonth, goal: t.cashTarget, money: true },
        { label: "Credit recovered", done: d.creditCollectedMonth, goal: t.creditRecoveryTarget, money: true },
      ].filter((x) => x.goal > 0)
    : [];

  const debtors = customers
    .map((c) => ({
      ...c,
      owed: c.sales.reduce((s, x) => s + (x.total - x.amountPaid), 0),
      overdue: c.sales.some((x) => x.creditStatus === "OVERDUE"),
    }))
    .sort((a, b) => b.owed - a.owed);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/reps"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All sales reps
      </Link>

      {/* Header + controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {rep.name}
            </h1>
            <StatusBadge status={rep.status} />
            {rep.region && <Badge variant="secondary">{rep.region}</Badge>}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Mail className="size-3.5" /> {rep.email}</span>
            {rep.phone && (
              <span className="inline-flex items-center gap-1.5"><Phone className="size-3.5" /> {rep.phone}</span>
            )}
            <span>Rep since {formatDate(rep.createdAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <IssueStockButton repId={rep.id} repName={rep.name} products={productOpts} />
          <SetTargetsButton repId={rep.id} repName={rep.name} current={t} />
          <TerritoryButton repId={rep.id} current={rep.region} />
          <RepStatusButton repId={rep.id} status={rep.status} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Sales this month"
          value={formatCurrency(d.salesMonth)}
          icon={TrendingUp}
          accent="primary"
          hint={
            d.salesMonth > 0 ? (
              <>
                <span className="block">
                  Cash {formatCurrency(d.cashSalesMonth)} · Credit {formatCurrency(d.creditSalesMonth)}
                </span>
                <span className="block">{formatNumber(d.unitsMonth)} units</span>
              </>
            ) : (
              `${formatNumber(d.unitsMonth)} units`
            )
          }
        />
        <StatCard label="Credit exposure" value={formatCurrency(d.creditOutstanding)} icon={CreditCard} accent="warning" hint={d.overdueCount > 0 ? `${d.overdueCount} overdue` : "all on track"} />
        <StatCard label="Stock in hand" value={formatNumber(d.stockInHand)} icon={Package} accent="info" hint={`+${formatNumber(d.samplesInHand)} samples`} />
        <StatCard label="Samples this month" value={formatNumber(d.samplesMonth)} icon={Gift} accent="accent" />
      </div>

      {/* Targets + stock */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="font-display text-lg font-semibold">Target progress</h2>
          {targetRows.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No targets set for this month — use “Set targets”.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {targetRows.map((x) => {
                const pct = Math.min(100, Math.round((x.done / x.goal) * 100));
                return (
                  <div key={x.label}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{x.label}</span>
                      <span className="font-semibold">
                        {x.money ? formatCurrency(x.done) : formatNumber(x.done)}
                        <span className="text-muted-foreground"> / {x.money ? formatCurrency(x.goal) : formatNumber(x.goal)}</span>
                      </span>
                    </div>
                    <Progress
                      value={pct}
                      className="mt-1.5"
                      indicatorClassName={cn(pct >= 100 ? "bg-success" : pct >= 60 ? "bg-primary" : "bg-warning")}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="font-display text-lg font-semibold">Stock with {rep.name.split(" ")[0]}</h2>
          <div className="mt-3 space-y-2">
            {d.stock.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing issued yet.</p>
            ) : (
              d.stock.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      received {formatNumber(s.receivedQty)} · sold {formatNumber(s.soldQty)} · sampled {formatNumber(s.sampledQty)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    <p className="font-semibold">{formatNumber(s.sellableQty)}</p>
                    <p className="text-xs text-muted-foreground">+{formatNumber(s.sampleQty)} samples</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Debtors */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Credit customers</h2>
        {debtors.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No field customers yet.
          </p>
        ) : (
          <div className="space-y-2">
            {debtors.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold">{c.name}</p>
                    {c.overdue && <Badge variant="destructive">Overdue</Badge>}
                    {c.creditSuspended && <Badge variant="secondary">Credit off</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {c.phone ?? "no phone"}
                    {c.location ? ` · ${c.location}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={cn("text-sm font-semibold", c.owed > 0 ? "text-warning" : "text-success")}>
                    {c.owed > 0 ? formatCurrency(c.owed) : "Clear"}
                  </span>
                  <CustomerCreditToggle customerId={c.id} suspended={c.creditSuspended} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sales history */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Sales history</h2>
        {sales.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No sales recorded yet.
          </p>
        ) : (
          <div className="space-y-2">
            {sales.map((s) => {
              const balance = s.total - s.amountPaid;
              return (
                <div
                  key={s.id}
                  className={`rounded-2xl border border-border bg-card p-4${
                    s.voided || s.financeStatus === "REJECTED" ? " opacity-60" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{s.code}</span>
                      <StatusBadge status={s.type} />
                      {s.creditStatus && s.financeStatus !== "REJECTED" && <StatusBadge status={s.creditStatus} />}
                      {s.voided && <Badge variant="destructive">Voided</Badge>}
                      {!s.voided && s.financeStatus === "REJECTED" && (
                        <Badge variant="destructive">Rejected by finance</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{formatCurrency(s.total)}</span>
                      {!s.voided && s.financeStatus !== "REJECTED" && <VoidSaleButton saleId={s.id} />}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.customer?.name ?? s.customerName ?? "Walk-in"} ·{" "}
                    {s.items.map((i) => `${i.product.name} × ${i.quantity}`).join(" · ")} ·{" "}
                    {timeAgo(s.createdAt)}
                  </p>
                  {s.type === "CREDIT" && !s.voided && s.financeStatus !== "REJECTED" && balance > 0 && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                      <p className="text-sm">
                        Owing <span className="font-semibold text-warning">{formatCurrency(balance)}</span>
                        {s.dueDate ? <span className="text-muted-foreground"> · due {formatDate(s.dueDate)}</span> : null}
                      </p>
                      <CollectForm saleId={s.id} balance={balance} accounts={accounts} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Reports + samples */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="font-display text-lg font-semibold">Field reports</h2>
          <div className="mt-3 space-y-2.5">
            {reports.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reports filed yet.</p>
            ) : (
              reports.map((r) => (
                <div key={r.id} className="rounded-xl border border-border/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="inline-flex items-center gap-1.5 text-sm font-medium">
                      <MapPin className="size-3.5 text-primary" /> {r.location}
                    </p>
                    <span className="text-xs text-muted-foreground">{formatDate(r.reportDate)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sales {formatCurrency(r.salesAchieved)} · {formatNumber(r.unitsSold)} units · collected {formatCurrency(r.creditCollected)}
                  </p>
                  {r.challenges && (
                    <p className="mt-1 text-xs text-muted-foreground">⚠ {r.challenges}</p>
                  )}
                  {r.marketFeedback && (
                    <p className="mt-0.5 text-xs text-muted-foreground">💬 {r.marketFeedback}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="font-display text-lg font-semibold">Sample distribution</h2>
          <div className="mt-3 space-y-2.5">
            {samples.length === 0 ? (
              <p className="text-sm text-muted-foreground">No samples recorded yet.</p>
            ) : (
              samples.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {formatNumber(l.quantity)} × {l.product.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {l.location}
                      {l.reason ? ` · ${l.reason}` : ""} · {timeAgo(l.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
