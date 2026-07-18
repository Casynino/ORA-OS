import {
  TrendingUp,
  Wallet,
  Percent,
  Package,
  Layers,
} from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { getFinanceOverview, type Period } from "@/lib/services/finance";
import { PageHeader } from "@/components/ui/page-header";
import { FinanceNav, PeriodTabs } from "@/components/admin/finance-nav";
import { StatCard } from "@/components/ui/stat-card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PERIOD_LABEL: Record<Period, string> = {
  today: "today",
  week: "this week",
  month: "this month",
  all: "all time",
};

/** Profit & Loss — one bottom line for ORA, built from the same engine as the
 *  Finance overview so revenue, COGS and profit never disagree across pages.
 *  Covers BOTH partner/warehouse orders and rep field sales. */
export default async function AdminFinanceProfitPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireRole("ADMIN");
  const { period: raw = "month" } = await searchParams;
  const period = (["today", "week", "month", "all"].includes(raw) ? raw : "month") as Period;

  const d = await getFinanceOverview(period);
  const w = d.window;
  const p = d.position;

  const netMargin = w.revenue > 0 ? (w.netProfit / w.revenue) * 100 : 0;
  const grossMargin = w.revenue > 0 ? (w.grossProfit / w.revenue) * 100 : 0;
  const potentialProfit = p.stockPotentialRevenue - p.stockValue;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profit & Loss"
        description="Revenue minus cost of goods and operating expenses — the real bottom line, across partner orders and rep sales."
      />
      <FinanceNav />

      <PeriodTabs period={period} basePath="/admin/finance/profit" />

      {/* Headline */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`Revenue ${PERIOD_LABEL[period]}`}
          value={formatCurrency(w.revenue)}
          icon={TrendingUp}
          accent="success"
          hint={`${formatNumber(w.unitsSold)} packs sold`}
        />
        <StatCard
          label="Gross profit"
          value={formatCurrency(w.grossProfit)}
          icon={Layers}
          accent="info"
          hint={`${Math.round(grossMargin)}% gross margin`}
        />
        <StatCard
          label="Net profit"
          value={formatCurrency(w.netProfit)}
          icon={Wallet}
          accent={w.netProfit >= 0 ? "primary" : "warning"}
          hint="after operating expenses"
        />
        <StatCard
          label="Profit margin"
          value={`${Math.round(netMargin)}%`}
          icon={Percent}
          accent="accent"
          hint="net profit ÷ revenue"
        />
      </div>

      {/* The statement + stock value */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="font-display text-lg font-semibold">
            Profit &amp; Loss statement
            <span className="text-sm font-normal text-muted-foreground"> · {PERIOD_LABEL[period]}</span>
          </h2>
          <div className="mt-4 space-y-1.5 rounded-xl border border-border/60 p-4 text-sm">
            <Row label={`Revenue (${formatNumber(w.unitsSold)} units sold)`} value={formatCurrency(w.revenue)} />
            <Row label="− Cost of goods sold" value={formatCurrency(w.cogs)} muted />
            <div className="my-1.5 border-t border-border/60" />
            <Row label="= Gross profit" value={formatCurrency(w.grossProfit)} strong />
            <Row label="− Operating expenses" value={formatCurrency(w.operatingExpenses)} muted />
            <div className="my-1.5 border-t border-border/60" />
            <Row
              label="= Net profit"
              value={formatCurrency(w.netProfit)}
              strong
              tone={w.netProfit >= 0 ? "text-success" : "text-destructive"}
            />
            <p className="pt-1 text-xs text-muted-foreground">
              Accrual profit — earned when goods are sold, not when cash lands. Stock purchases
              aren&apos;t double-counted; they reach profit through cost of goods sold.
            </p>
          </div>

          {/* Operating expense breakdown */}
          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Where operating costs went
          </h3>
          <div className="mt-2 space-y-2.5">
            {w.operatingCategories.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                No operating expenses recorded {PERIOD_LABEL[period]}.
              </p>
            ) : (
              w.operatingCategories.map((c) => {
                const pct = w.operatingExpenses > 0 ? Math.round((c.amount / w.operatingExpenses) * 100) : 0;
                return (
                  <div key={c.category}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{c.label}</span>
                      <span className="font-semibold">
                        {formatCurrency(c.amount)} <span className="text-xs text-muted-foreground">({pct}%)</span>
                      </span>
                    </div>
                    <Progress value={pct} className="mt-1" />
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="font-display text-lg font-semibold">Value sitting in stock</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Profit locked in unsold inventory — not yet earned, but waiting.
          </p>
          <div className="mt-4 space-y-3">
            <StockRow
              icon={Package}
              accent="info"
              label="Inventory value (cost)"
              value={formatCurrency(p.stockValue)}
              hint="what the stock cost ORA"
            />
            <StockRow
              icon={TrendingUp}
              accent="success"
              label="Potential revenue"
              value={formatCurrency(p.stockPotentialRevenue)}
              hint="if every pack sells at list price"
            />
            <StockRow
              icon={Wallet}
              accent="primary"
              label="Potential profit"
              value={formatCurrency(potentialProfit)}
              valueTone={potentialProfit < 0 ? "text-destructive" : undefined}
              hint="locked in current stock"
            />
          </div>
        </section>
      </div>

      {/* Per-product profit */}
      <section className="rounded-2xl border border-border bg-card shadow-soft">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold">
            Profit by product
            <span className="text-sm font-normal text-muted-foreground"> · {PERIOD_LABEL[period]}</span>
          </h2>
        </div>
        {w.productProfit.length === 0 ? (
          <EmptyState className="m-6" icon={TrendingUp} title="No sales in this period" />
        ) : (
          <Table wrapperClassName="table-stack">
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Packs</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {w.productProfit.map((row) => (
                <TableRow key={row.id}>
                  <TableCell data-cardtitle className="font-medium">{row.name}</TableCell>
                  <TableCell data-label="Packs" className="text-right">{formatNumber(row.units)}</TableCell>
                  <TableCell data-label="Revenue" className="text-right">{formatCurrency(row.revenue)}</TableCell>
                  <TableCell
                    data-label="Profit"
                    className={cn("text-right font-medium", row.profit >= 0 ? "text-success" : "text-destructive")}
                  >
                    {formatCurrency(row.profit)}
                  </TableCell>
                  <TableCell data-label="Margin" className="text-right">{Math.round(row.margin)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  strong,
  tone,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn("min-w-0 truncate", muted ? "text-muted-foreground" : "")}>{label}</span>
      <span className={cn("shrink-0", strong ? "font-bold" : "font-medium", tone)}>{value}</span>
    </div>
  );
}

function StockRow({
  icon: Icon,
  accent,
  label,
  value,
  hint,
  valueTone,
}: {
  icon: typeof Package;
  accent: "info" | "success" | "primary";
  label: string;
  value: string;
  hint: string;
  valueTone?: string;
}) {
  const tone =
    accent === "success"
      ? "bg-success/10 text-success"
      : accent === "primary"
        ? "bg-primary/10 text-primary"
        : "bg-info/10 text-info";
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
      <span className="flex items-center gap-2.5 text-sm font-medium">
        <span className={cn("flex size-8 items-center justify-center rounded-lg", tone)}>
          <Icon className="size-4" />
        </span>
        <span>
          {label}
          <span className="block text-xs font-normal text-muted-foreground">{hint}</span>
        </span>
      </span>
      <span className={cn("shrink-0 font-display font-semibold", valueTone)}>{value}</span>
    </div>
  );
}
