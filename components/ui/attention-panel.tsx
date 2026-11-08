"use client";

import Link from "next/link";
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle, Banknote, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, ClipboardCheck,
  Clock, CreditCard, Landmark, PackageX, Receipt, Truck, Undo2, Wallet, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Needs your attention" — the ONE small panel used on every dashboard (Admin, Finance, Partner,
 * Developer). Same look and size everywhere, phone included: a tiny heading with a count, filter
 * pills (only when there is more than one group), then slim rows with three in view and the rest a
 * scroll away. The height is measured from the real rows, so exactly three fit even when a title
 * wraps on a phone. Icons are chosen by a string key because a Server Component can't hand function
 * components to a client component.
 */

export type AttnTone = "danger" | "warning" | "info";
export type AttentionIconKey =
  | "overdue" | "dueSoon" | "stock" | "cash" | "credit" | "collect" | "fund"
  | "deposit" | "payment" | "truck" | "review" | "return";
export type AttentionTab = { key: string; label: string };
export type AttentionPanelItem = {
  id: string;
  /** which filter pill the row belongs to (one of the panel's `tabs`) */
  group: string;
  tone: AttnTone;
  icon: AttentionIconKey;
  title: string;
  detail: string;
  /** the amount or count shown on the right (and in front of the detail on phones) */
  main?: string;
  href: string;
};

const ICONS: Record<AttentionIconKey, LucideIcon> = {
  overdue: AlertTriangle, dueSoon: Clock, stock: PackageX, cash: Banknote, credit: CreditCard,
  collect: Receipt, fund: Wallet, deposit: Landmark, payment: ClipboardCheck, truck: Truck,
  review: Clock, return: Undo2,
};
const BAR: Record<AttnTone, string> = { danger: "bg-destructive", warning: "bg-warning", info: "bg-info" };
const ICON_TONE: Record<AttnTone, string> = { danger: "text-destructive", warning: "text-warning", info: "text-info" };

const VISIBLE = 3;
/** Until the rows are measured (first paint) only the first three show, so nothing jumps. */
const HIDE_AFTER_3 = "[&_[data-row]:nth-child(n+4)]:hidden";

/**
 * Shows the first three rows (elements marked `data-row`); the rest scroll inside. The bar underneath
 * says how many are still below and brings them up when pressed; at the end it says "Back to the top".
 */
export function ShowRows({ total, children }: { total: number; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [max, setMax] = useState<number | null>(null);
  const [below, setBelow] = useState(total - VISIBLE);
  const extra = total - VISIBLE;

  const parts = useCallback(() => {
    const el = box.current!;
    const rect = el.getBoundingClientRect();
    const rows = [...el.querySelectorAll<HTMLElement>("[data-row]")];
    const visibleBottom = rect.top + el.clientHeight;
    return { el, rect, rows, hidden: rows.filter((r) => r.getBoundingClientRect().bottom > visibleBottom + 1) };
  }, []);

  useLayoutEffect(() => {
    if (!box.current || extra <= 0) return;
    const measure = () => {
      const { el, rect, rows } = parts();
      const last = rows[VISIBLE - 1];
      if (!last) return;
      setMax(Math.ceil(last.getBoundingClientRect().bottom - (rect.top - el.scrollTop)));
      requestAnimationFrame(() => box.current && setBelow(parts().hidden.length));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box.current);
    return () => ro.disconnect();
  }, [extra, parts]);

  if (extra <= 0) return <div>{children}</div>;

  const step = () => {
    const { el, rect, hidden } = parts();
    if (!hidden.length) {
      el.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    el.scrollTo({ top: el.scrollTop + hidden[0].getBoundingClientRect().top - rect.top, behavior: "smooth" });
  };

  return (
    <div>
      <div className="relative">
        <div
          ref={box}
          className={cn("relative overflow-auto overscroll-contain scrollbar-thin", max === null && HIDE_AFTER_3)}
          style={max === null ? undefined : { maxHeight: max }}
          onScroll={() => setBelow(parts().hidden.length)}
        >
          {children}
        </div>
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-black/20 to-transparent transition-opacity dark:from-black/40",
            !below && "opacity-0",
          )}
        />
      </div>
      <button
        type="button"
        onClick={step}
        className="flex w-full items-center justify-center gap-1 border-t border-border/60 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
      >
        {below ? (
          <>
            <ChevronDown className="size-3" />
            Scroll for {below} more
          </>
        ) : (
          <>
            <ChevronUp className="size-3" />
            Back to the top
          </>
        )}
      </button>
    </div>
  );
}

/** The small heading: label + count, and an optional link on the right. */
export function AttentionHeading({ count, action }: { count: number; action?: { label: string; href: string } }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Needs your attention
        {count > 0 && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold tracking-normal text-primary">{count}</span>
        )}
      </h2>
      {action && (
        <Link href={action.href} className="shrink-0 text-[11px] font-medium text-primary transition-colors hover:text-primary/80">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function AttentionPanel({
  items,
  tabs = [],
  empty = "Nothing needs your attention right now.",
  action,
  className,
}: {
  items: AttentionPanelItem[];
  tabs?: AttentionTab[];
  empty?: string;
  action?: { label: string; href: string };
  className?: string;
}) {
  const [tab, setTab] = useState("all");
  const shown = tab === "all" ? items : items.filter((i) => i.group === tab);
  const count = (k: string) => (k === "all" ? items.length : items.filter((i) => i.group === k).length);
  // Pills for groups with nothing in them are not drawn; a single group needs no pills at all.
  const live = tabs.filter((t) => t.key === tab || count(t.key) > 0);
  const chips: AttentionTab[] = live.length > 1 ? [{ key: "all", label: "All" }, ...live] : [];

  return (
    <section aria-label="Needs your attention" className={className}>
      <AttentionHeading count={items.length} action={items.length > 0 ? action : undefined} />
      {chips.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter">
          {chips.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label} <span className="opacity-60">{count(t.key)}</span>
            </button>
          ))}
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        {shown.length === 0 ? (
          <div className="flex items-center gap-2.5 px-3.5 py-3 text-[13px] text-success">
            <CheckCircle2 className="size-4 shrink-0" />
            {items.length === 0 ? empty : "Nothing here."}
          </div>
        ) : (
          <ShowRows key={tab} total={shown.length}>
            <ul className="divide-y divide-border/60">
              {shown.map((i) => {
                const Icon = ICONS[i.icon] ?? AlertTriangle;
                return (
                  <li key={i.id} data-row>
                    <Link href={i.href} className="group flex items-center gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-muted/40">
                      <span aria-hidden className={cn("h-7 w-[3px] shrink-0 rounded-full", BAR[i.tone])} />
                      <Icon className={cn("size-4 shrink-0", ICON_TONE[i.tone])} />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 block text-[13px] font-semibold leading-tight text-foreground sm:line-clamp-1">{i.title}</span>
                        <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                          {i.main && <span className="font-medium text-foreground/80 sm:hidden">{i.main} · </span>}
                          {i.detail}
                        </span>
                      </span>
                      {i.main && (
                        <span className="hidden shrink-0 text-[13px] font-bold tabular-nums leading-tight text-foreground sm:block">{i.main}</span>
                      )}
                      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </ShowRows>
        )}
      </div>
    </section>
  );
}
