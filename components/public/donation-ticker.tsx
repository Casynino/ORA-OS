"use client";

import { useEffect, useRef, useState } from "react";
import { Heart, Zap } from "lucide-react";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

export type FeedItem = {
  id: string;
  name: string;
  amount: number | null;
  pads: number | null;
  at: string;
};
export type Feed = {
  counters: { moneyRaised: number; padsSponsored: number; donations: number; donors: number };
  recent: FeedItem[];
};

function Pill({ d }: { d: FeedItem }) {
  return (
    <span className="mr-3 inline-flex shrink-0 items-center gap-2 rounded-full border border-primary/25 bg-gradient-to-r from-primary/[0.14] to-accent/[0.14] py-1.5 pl-3 pr-4 shadow-sm">
      <Heart className="size-3.5 shrink-0 animate-heart-beat fill-primary text-primary" />
      <span className="whitespace-nowrap text-sm">
        <span className="font-semibold">{d.name}</span>{" "}
        <span className="text-muted-foreground">donated</span>{" "}
        <span className="text-gradient font-bold">
          {d.amount != null ? formatCurrency(d.amount) : `${formatNumber(d.pads ?? 0)} pads`}
        </span>
      </span>
    </span>
  );
}

/** The scrolling strip: a "LIVE" badge + donor pills gliding across forever. */
export function TickerStrip({
  items,
  className,
  glow,
}: {
  items: FeedItem[];
  className?: string;
  glow?: boolean;
}) {
  // Repeat into a wide base, then duplicate once for a seamless -50% loop.
  const base = items.length
    ? Array.from({ length: Math.max(items.length, 6) }, (_, i) => items[i % items.length])
    : [];
  const loop = base.length ? [...base, ...base] : [];
  const duration = `${Math.max(22, base.length * 5)}s`;

  return (
    <div
      className={cn(
        "marquee-row relative overflow-hidden rounded-2xl border border-border/70 bg-muted/20 py-2.5 transition-shadow duration-500",
        glow && "border-primary/50 shadow-glow",
        className,
      )}
    >
      <span className="live-shimmer pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
      {/* LIVE badge + left fade */}
      <span className="absolute left-0 top-0 z-20 flex h-full items-center gap-1.5 bg-gradient-to-r from-card via-card/95 to-transparent pl-3.5 pr-10 text-xs font-bold uppercase tracking-wide text-success">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-success" />
        </span>
        Live
      </span>
      <span className="pointer-events-none absolute right-0 top-0 z-20 h-full w-14 bg-gradient-to-l from-card to-transparent" />

      {loop.length === 0 ? (
        <p className="flex items-center gap-2 px-4 pl-20 text-sm text-muted-foreground">
          <Zap className="size-4 text-primary" />
          Be the first — your name scrolls across here the moment you donate.
        </p>
      ) : (
        <div
          className="animate-ticker flex w-max items-center"
          style={{ animationDuration: duration }}
        >
          {loop.map((d, i) => (
            <Pill key={`${d.id}-${i}`} d={d} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Self-contained live ticker bar (polls the feed) — for the landing page. */
export function DonationTicker({ initial }: { initial: Feed }) {
  const [items, setItems] = useState<FeedItem[]>(initial.recent);
  const [glow, setGlow] = useState(false);
  const topId = useRef(initial.recent[0]?.id ?? null);

  useEffect(() => {
    let alive = true;
    async function pull() {
      try {
        const res = await fetch("/api/donations/feed", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const next: Feed = await res.json();
        if (!alive) return;
        const top = next.recent[0]?.id ?? null;
        if (top && top !== topId.current) {
          topId.current = top;
          setGlow(true);
          setTimeout(() => alive && setGlow(false), 1800);
        }
        setItems(next.recent);
      } catch {
        /* keep last good data */
      }
    }
    const t = setInterval(pull, 4000);
    pull();
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return <TickerStrip items={items} glow={glow} className="bg-card/70 backdrop-blur-xl" />;
}
