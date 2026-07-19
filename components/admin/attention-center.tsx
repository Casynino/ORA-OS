"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle, Clock, PackageX, Banknote, CreditCard, Receipt, Wallet,
  ChevronRight, CheckCircle2, ArrowRight, Bell,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

// One bounded, filterable command center for everything the CEO must act on —
// credit alerts, low stock, and the finance sign-off pipeline. It never grows
// past a fixed height (internal scroll), so a busy day can't push the rest of
// the dashboard out of view. Icons are resolved from a string key because a
// Server Component can't hand function components across the RSC boundary.

export type AttnCategory = "overdue" | "dueSoon" | "signoff" | "funds" | "stock";
export type AttnTone = "danger" | "warning" | "info";

export type AttnItem = {
  key: string;
  category: AttnCategory;
  iconKey: "overdue" | "dueSoon" | "stock" | "cash" | "credit" | "collect" | "fund";
  tone: AttnTone;
  label: string;
  hint: string;
  amount?: number | null;
  href: string;
};

const ICONS: Record<AttnItem["iconKey"], LucideIcon> = {
  overdue: AlertTriangle, dueSoon: Clock, stock: PackageX,
  cash: Banknote, credit: CreditCard, collect: Receipt, fund: Wallet,
};

const CATEGORY: Record<AttnCategory, { label: string; tone: AttnTone; priority: number }> = {
  overdue: { label: "Overdue", tone: "danger", priority: 0 },
  signoff: { label: "Sign-offs", tone: "info", priority: 1 },
  funds: { label: "Fund requests", tone: "warning", priority: 2 },
  dueSoon: { label: "Due soon", tone: "warning", priority: 3 },
  stock: { label: "Low stock", tone: "warning", priority: 4 },
};
const CAT_ORDER: AttnCategory[] = ["overdue", "signoff", "funds", "dueSoon", "stock"];

const TONE_CHIP: Record<AttnTone, string> = {
  danger: "bg-destructive/12 text-destructive",
  warning: "bg-warning/12 text-warning",
  info: "bg-info/12 text-info",
};
const PILL_ACTIVE: Record<AttnTone | "all", string> = {
  all: "border-primary/40 bg-primary/12 text-primary",
  danger: "border-destructive/40 bg-destructive/12 text-destructive",
  warning: "border-warning/40 bg-warning/12 text-warning",
  info: "border-info/40 bg-info/12 text-info",
};

export function AttentionCenter({ items }: { items: AttnItem[] }) {
  const [filter, setFilter] = useState<AttnCategory | "all">("all");

  const sorted = useMemo(
    () => [...items].sort((a, b) => CATEGORY[a.category].priority - CATEGORY[b.category].priority),
    [items],
  );
  const total = sorted.length;

  const cats = useMemo(
    () => CAT_ORDER.map((c) => ({ c, count: sorted.filter((i) => i.category === c).length })).filter((x) => x.count > 0),
    [sorted],
  );
  // Guard against a filter that no longer has any items (data refresh).
  const active = filter !== "all" && cats.some((x) => x.c === filter) ? filter : "all";
  const visible = active === "all" ? sorted : sorted.filter((i) => i.category === active);
  const hasSignoff = sorted.some((i) => i.category === "signoff");

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Needs your attention
          {total > 0 && (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-[11px] font-bold tabular-nums text-primary">
              {total}
            </span>
          )}
        </p>
        {hasSignoff && (
          <Link href="/admin/sales-approvals" className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80">
            Review all <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>

      {total === 0 ? (
        <p className="flex items-center gap-2 rounded-2xl border border-success/20 bg-success/[0.04] px-4 py-3.5 text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" />
          All clear — nothing needs your attention right now.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/50">
          {/* Filter pills — the at-a-glance shape of the queue (only when it spans categories). */}
          {cats.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-border/50 px-2.5 py-2">
              <FilterPill label="All" count={total} tone="all" active={active === "all"} onClick={() => setFilter("all")} />
              {cats.map(({ c, count }) => (
                <FilterPill key={c} label={CATEGORY[c].label} count={count} tone={CATEGORY[c].tone} active={active === c} onClick={() => setFilter(c)} />
              ))}
            </div>
          )}

          {/* Bounded, scrolling priority list — fixed height, most urgent first. */}
          <div key={active} className="max-h-[17.5rem] divide-y divide-border/50 overflow-y-auto scrollbar-thin">
            {visible.map((item, i) => {
              const Icon = ICONS[item.iconKey];
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className="group flex animate-fade-in items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                  style={{ animationDelay: `${Math.min(i, 7) * 45}ms` }}
                >
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", TONE_CHIP[item.tone])}>
                    <Icon className="size-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.hint}</p>
                  </div>
                  {item.amount != null && (
                    <span className="shrink-0 font-display text-sm font-semibold tabular-nums text-foreground">{formatCurrency(item.amount)}</span>
                  )}
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                </Link>
              );
            })}
            {visible.length === 0 && (
              <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                <Bell className="size-4 shrink-0" /> Nothing in this group right now.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function FilterPill({
  label, count, tone, active, onClick,
}: {
  label: string; count: number; tone: AttnTone | "all"; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
        active ? PILL_ACTIVE[tone] : "border-border/60 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      {label}
      <span className={cn("rounded-full px-1.5 text-[10px] font-semibold tabular-nums", active ? "bg-background/25" : "bg-muted text-muted-foreground")}>
        {count}
      </span>
    </button>
  );
}
