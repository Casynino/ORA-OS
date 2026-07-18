import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Wallet, Banknote, CreditCard, TrendingUp, AlertTriangle, CalendarClock,
  Users, UserPlus, Building2, Star, ArrowRight, ShieldCheck, Clock,
} from "lucide-react";
import type { CollectionsIntelligence, CustomerIntelligence, TrendPoint } from "@/lib/services/intelligence";
import type { HumanActivity } from "@/lib/activity-format";
import { humanizeActivity } from "@/lib/activity-format";
import { cn, formatCurrency, formatNumber, formatDate, timeAgo } from "@/lib/utils";

// Shared little pieces so the command-centre sections read consistently.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

const ACCENT: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/12 text-accent",
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-warning",
  info: "bg-info/12 text-info",
  danger: "bg-destructive/12 text-destructive",
};

function Stat({
  icon: Icon, label, value, hint, accent = "primary", href,
}: {
  icon: LucideIcon; label: string; value: string; hint?: React.ReactNode; accent?: string; href?: string;
}) {
  const body = (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft transition-colors hover:border-primary/30">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", ACCENT[accent])}>
          <Icon className="size-3.5" />
        </span>
      </div>
      <p className="mt-2 font-display text-xl font-bold tracking-tight sm:text-2xl">{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

// ── CEO Financial Overview — revenue split cash vs credit ─────────────────────

export function FinancialOverview({
  totalRevenue, cashRevenue, creditRevenue, cashCollected, outstanding, periodLabel,
}: {
  totalRevenue: number; cashRevenue: number; creditRevenue: number;
  cashCollected: number; outstanding: number; periodLabel: string;
}) {
  const cashPct = totalRevenue > 0 ? (cashRevenue / totalRevenue) * 100 : 0;
  const creditPct = totalRevenue > 0 ? (creditRevenue / totalRevenue) * 100 : 0;
  return (
    <section>
      <SectionLabel>CEO financial overview · {periodLabel}</SectionLabel>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="glass-card rounded-2xl p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm text-muted-foreground">Total revenue {periodLabel}</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">sold — cash + credit</span>
          </div>
          <p className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">{formatCurrency(totalRevenue)}</p>
          {/* cash vs credit split bar */}
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-muted">
            <div className="bg-success" style={{ width: `${cashPct}%` }} title={`Cash ${formatCurrency(cashRevenue)}`} />
            <div className="bg-warning" style={{ width: `${creditPct}%` }} title={`Credit ${formatCurrency(creditRevenue)}`} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-success" />
                <span className="text-xs text-muted-foreground">Cash revenue</span>
              </div>
              <p className="mt-0.5 font-display text-lg font-bold">{formatCurrency(cashRevenue)}</p>
              <p className="text-[11px] text-muted-foreground">{Math.round(cashPct)}% of sales · paid on the spot</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-warning" />
                <span className="text-xs text-muted-foreground">Credit revenue</span>
              </div>
              <p className="mt-0.5 font-display text-lg font-bold">{formatCurrency(creditRevenue)}</p>
              <p className="text-[11px] text-muted-foreground">{Math.round(creditPct)}% of sales · owed to ORA</p>
            </div>
          </div>
        </div>
        <div className="grid grid-rows-2 gap-4">
          <Stat icon={Banknote} accent="success" label="Cash collected" value={formatCurrency(cashCollected)} hint={`money actually in hand ${periodLabel}`} />
          <Stat icon={Wallet} accent={outstanding > 0 ? "warning" : "info"} label="Outstanding credit" value={formatCurrency(outstanding)} hint="revenue still owed to ORA" href="/admin/credit" />
        </div>
      </div>
    </section>
  );
}

// ── Collections required + credit monitoring ─────────────────────────────────

export function CollectionsAndCredit({ ci }: { ci: CollectionsIntelligence }) {
  return (
    <section className="space-y-4">
      <SectionLabel>Collections required · money to bring in</SectionLabel>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={CalendarClock} accent="info" label="Due this week" value={formatCurrency(ci.dueThisWeek)} hint="next 7 days" href="/admin/credit" />
        <Stat icon={CalendarClock} accent="primary" label="Due this month" value={formatCurrency(ci.dueThisMonth)} hint="before month-end" href="/admin/credit" />
        <Stat icon={AlertTriangle} accent={ci.overdueTotal > 0 ? "danger" : "success"} label="Overdue" value={formatCurrency(ci.overdueTotal)} hint={`${ci.overdueCount} ${ci.overdueCount === 1 ? "customer" : "customers"} past due`} href="/admin/credit" />
        <Stat icon={ShieldCheck} accent="success" label="Collection rate" value={`${ci.collectionRate}%`} hint="collected ÷ billed, all credit" />
      </div>

      {/* Credit performance strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniPill label="Active credit customers" value={formatNumber(ci.activeCreditCustomers)} tone="info" />
        <MiniPill label="Good standing" value={formatNumber(ci.goodPayers)} tone="success" />
        <MiniPill label="At risk (overdue)" value={formatNumber(ci.atRiskCustomers)} tone={ci.atRiskCustomers > 0 ? "danger" : "success"} />
        <MiniPill label="Owed in total" value={formatCurrency(ci.outstandingTotal)} tone="warning" />
      </div>

      {/* Two lists: overdue (act now) + due soon */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-card rounded-2xl p-5">
          <h3 className="flex items-center gap-2 font-display font-semibold">
            <AlertTriangle className="size-4 text-destructive" /> Follow up — overdue
          </h3>
          {ci.overdue.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No overdue customers — collections are on track.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border/60">
              {ci.overdue.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.customer}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.daysOverdue} {r.daysOverdue === 1 ? "day" : "days"} overdue
                      {r.rep ? ` · ${r.rep}` : r.channel === "partner" ? " · partner" : ""}
                      {r.lastPayment ? ` · last paid ${timeAgo(r.lastPayment)}` : " · no payments"}
                    </p>
                  </div>
                  <span className="shrink-0 font-display font-semibold text-destructive">{formatCurrency(r.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="glass-card rounded-2xl p-5">
          <h3 className="flex items-center gap-2 font-display font-semibold">
            <Clock className="size-4 text-info" /> Coming due soon
          </h3>
          {ci.dueSoon.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nothing due in the near term.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border/60">
              {ci.dueSoon.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.customer}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.dueDate ? `due ${formatDate(r.dueDate)}` : "no due date"}
                      {r.rep ? ` · ${r.rep}` : r.channel === "partner" ? " · partner" : ""}
                    </p>
                  </div>
                  <span className="shrink-0 font-display font-semibold">{formatCurrency(r.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function MiniPill({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 font-display text-lg font-bold", {
        "text-success": tone === "success",
        "text-destructive": tone === "danger",
        "text-warning": tone === "warning",
        "text-info": tone === "info",
      })}>{value}</p>
    </div>
  );
}

// ── Customer intelligence ────────────────────────────────────────────────────

export function CustomerIntelligencePanel({ cust }: { cust: CustomerIntelligence }) {
  const maxType = Math.max(1, ...cust.byType.map((t) => t.count));
  return (
    <section className="space-y-4">
      <SectionLabel>Customer intelligence · who ORA sells to</SectionLabel>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat icon={Users} accent="primary" label="Total customers" value={formatNumber(cust.total)} hint="field customers" href="/admin/customers" />
        <Stat icon={TrendingUp} accent="success" label="Active this month" value={formatNumber(cust.activeThisMonth)} hint="bought this month" />
        <Stat icon={CreditCard} accent="warning" label="Credit customers" value={formatNumber(cust.creditCustomers)} hint="carry a balance" />
        <Stat icon={Banknote} accent="info" label="Cash customers" value={formatNumber(cust.cashCustomers)} hint="no open credit" />
        <Stat icon={UserPlus} accent="accent" label="New this month" value={formatNumber(cust.newThisMonth)} hint="just onboarded" />
        <Stat icon={Building2} accent="primary" label="Partners" value={formatNumber(cust.partners)} hint="wholesale channel" href="/admin/users" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {/* By type */}
        <div className="glass-card rounded-2xl p-5">
          <h3 className="font-display font-semibold">Customers by business type</h3>
          {cust.byType.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No customers registered yet.</p>
          ) : (
            <div className="mt-4 space-y-2.5">
              {cust.byType.map((t) => (
                <div key={t.type}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{t.type}</span>
                    <span className="shrink-0 font-medium text-muted-foreground">{formatNumber(t.count)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${(t.count / maxType) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Top customers */}
        <div className="glass-card rounded-2xl p-5">
          <h3 className="flex items-center gap-2 font-display font-semibold">
            <Star className="size-4 text-warning" /> Top customers by revenue
          </h3>
          {cust.topCustomers.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No sales recorded yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border/60">
              {cust.topCustomers.map((c, i) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.type ?? "—"}{c.outstanding > 0 ? ` · ${formatCurrency(c.outstanding)} owed` : ""}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 font-display font-semibold">{formatCurrency(c.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Revenue & cash-flow trends (cash vs credit kept apart) ───────────────────

export function RevenueTrends({ trends }: { trends: TrendPoint[] }) {
  const maxRevenue = Math.max(1, ...trends.map((t) => t.totalRevenue));
  const maxFlow = Math.max(1, ...trends.map((t) => Math.max(t.collections, t.expenses)));
  return (
    <section>
      <SectionLabel>Trends · last 6 months</SectionLabel>
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Revenue — stacked cash vs credit */}
        <div className="glass-card rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold">Revenue — cash vs credit</h3>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-success" /> Cash</span>
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-warning" /> Credit</span>
            </div>
          </div>
          <div className="mt-5 flex h-40 items-end justify-between gap-2">
            {trends.map((t) => {
              const h = (t.totalRevenue / maxRevenue) * 100;
              const cashH = t.totalRevenue > 0 ? (t.cashRevenue / t.totalRevenue) * 100 : 0;
              return (
                <div key={t.key} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex w-full max-w-9 flex-1 items-end">
                    <div className="flex w-full flex-col justify-end overflow-hidden rounded-md bg-muted" style={{ height: `${Math.max(h, 2)}%` }} title={`${t.label}: ${formatCurrency(t.totalRevenue)}`}>
                      <div className="w-full bg-warning" style={{ height: `${100 - cashH}%` }} />
                      <div className="w-full bg-success" style={{ height: `${cashH}%` }} />
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{t.label}</span>
                </div>
              );
            })}
          </div>
        </div>
        {/* Collections vs expenses */}
        <div className="glass-card rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold">Collections vs expenses</h3>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-info" /> Collected</span>
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-destructive" /> Spent</span>
            </div>
          </div>
          <div className="mt-5 flex h-40 items-end justify-between gap-2">
            {trends.map((t) => (
              <div key={t.key} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex w-full items-end justify-center gap-1" style={{ height: "100%" }}>
                  <div className="w-2.5 rounded-t bg-info" style={{ height: `${Math.max((t.collections / maxFlow) * 100, 1)}%` }} title={`Collected ${formatCurrency(t.collections)}`} />
                  <div className="w-2.5 rounded-t bg-destructive" style={{ height: `${Math.max((t.expenses / maxFlow) * 100, 1)}%` }} title={`Spent ${formatCurrency(t.expenses)}`} />
                </div>
                <span className="text-[10px] text-muted-foreground">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Humanized activity feed ──────────────────────────────────────────────────

const TONE_DOT: Record<HumanActivity["tone"], string> = {
  in: "bg-success",
  out: "bg-destructive",
  neutral: "bg-gradient-to-br from-primary to-accent",
};

export function HumanActivityFeed({
  rows, title = "Financial activity", live = false, empty = "Activity will stream here.",
}: {
  rows: { id: string; action: string; summary: string; actorName?: string | null; createdAt: Date }[];
  title?: string;
  live?: boolean;
  empty?: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display font-semibold">
          <Banknote className="size-4" /> {title}
        </h3>
        {live && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-success">
            <span className="size-1.5 animate-pulse rounded-full bg-success" /> Live
          </span>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((a) => {
            const h = humanizeActivity(a);
            return (
              <li key={a.id} className="flex gap-3">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", TONE_DOT[h.tone])} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">{h.title}</p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(a.createdAt)}</span>
                  </div>
                  {h.detail && <p className="text-xs leading-snug text-muted-foreground">{h.detail}{a.actorName ? ` · ${a.actorName}` : ""}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
