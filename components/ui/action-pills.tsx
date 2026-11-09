import { Fragment } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * THE SHORTCUT ROW under a department's banner — copied from Target Express.
 *
 * The handful of things a person starts many times a day: a toolbar, not a second sidebar (the
 * sidebar is where you go to FIND a page; this is where you go to START a job). On a computer each
 * is one calm pill — a light surface, a fine edge, the icon in its own colour, plain text. On a phone
 * every shortcut is a plain line icon in its own colour with ONE word under it, as an app names its
 * icons, in equal shares of the row (two tidy rows when there are many).
 *
 * Colour is a landmark, not decoration: it colours the icon only — never a filled block — so six
 * colours sit together without any of them shouting, and each shortcut keeps its colour everywhere.
 */

export type ActionPillTone = "brand" | "signal" | "success" | "warning" | "info" | "violet";

export type ActionPill = {
  href: string;
  label: string;
  icon: LucideIcon;
  tone?: ActionPillTone;
  /** One word for the phone icon ("Approve orders" → "Orders"). The full label stays on a computer. */
  short?: string;
  /** How many are waiting (shown as a small count on the icon). */
  badge?: number;
};

/** The pill on a computer. */
export const PILL =
  "items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3.5 py-1.5 text-sm font-medium text-foreground/85 shadow-sm transition-colors hover:border-border hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";

/** The icon colours. */
export const GLYPH: Record<ActionPillTone, string> = {
  brand: "text-primary",
  signal: "text-destructive",
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
  violet: "text-accent",
};

/** The phone icon's frame; each takes an equal share of the row. */
export const PHONE_TILE =
  "relative flex min-w-0 flex-col items-center gap-1.5 rounded-xl px-0.5 py-1.5 text-center transition-transform active:scale-95 active:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:hidden";

/** The inside of a phone icon: the line drawing, and one word under it. */
export function PhoneTileFace({
  icon: Icon,
  label,
  tone = "brand",
  badge,
}: {
  icon: LucideIcon;
  label: string;
  tone?: ActionPillTone;
  badge?: number;
}) {
  return (
    <>
      <span className="relative">
        <Icon className={cn("size-6", GLYPH[tone])} strokeWidth={1.6} />
        {badge ? (
          <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </span>
      <span className="w-full truncate text-[10px] leading-tight text-foreground/80">{label}</span>
    </>
  );
}

/** Columns the phone row uses: one line up to six, then two tidy rows (and never more than four across on a very narrow phone). */
function phoneColumns(count: number) {
  if (count <= 6) return Math.max(1, count);
  return count <= 8 ? 4 : 5;
}

export function ActionPills({
  items,
  lead,
  leadTiles = 0,
  after,
  afterTiles = 0,
  label = "Quick actions",
}: {
  items: ActionPill[];
  /** Actions that open a form (not a destination), shown FIRST in the same row — see ActionTrigger. */
  lead?: React.ReactNode;
  /** How many icons `lead` draws on a phone, so the rows can be counted. */
  leadTiles?: number;
  /** The same, but after the links. */
  after?: React.ReactNode;
  afterTiles?: number;
  label?: string;
}) {
  const tiles = items.length + (lead ? leadTiles : 0) + (after ? afterTiles : 0);
  if (tiles === 0) return null;

  return (
    <nav
      aria-label={label}
      className="grid [grid-template-columns:repeat(var(--cols),minmax(0,1fr))] max-[359px]:[grid-template-columns:repeat(var(--cols-narrow),minmax(0,1fr))] sm:flex sm:flex-wrap sm:gap-2"
      style={{ "--cols": phoneColumns(tiles), "--cols-narrow": Math.min(tiles, 4) } as React.CSSProperties}
    >
      {lead ? <div className="contents">{lead}</div> : null}
      {items.map((item) => (
        <Fragment key={item.href + item.label}>
          <Link href={item.href} aria-label={item.label} title={item.label} className={PHONE_TILE}>
            <PhoneTileFace icon={item.icon} label={item.short ?? item.label} tone={item.tone ?? "brand"} badge={item.badge} />
          </Link>
          <Link href={item.href} className={cn("hidden sm:inline-flex", PILL)}>
            <item.icon className={cn("size-4", GLYPH[item.tone ?? "brand"])} strokeWidth={1.75} />
            {item.label}
            {item.badge ? (
              <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white">
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            ) : null}
          </Link>
        </Fragment>
      ))}
      {after ? <div className="contents">{after}</div> : null}
    </nav>
  );
}
