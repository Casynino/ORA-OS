"use client";

import { useEffect, useRef, useState } from "react";
import { HeartHandshake, Coins, Droplets, Users, Sparkles } from "lucide-react";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

type Feed = {
  counters: { moneyRaised: number; padsSponsored: number; donations: number; donors: number };
  recent: { id: string; name: string; amount: number | null; pads: number | null; at: string }[];
};

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#ec4899,#a855f7)",
  "linear-gradient(135deg,#06b6d4,#3b82f6)",
  "linear-gradient(135deg,#f59e0b,#ef4444)",
  "linear-gradient(135deg,#10b981,#14b8a6)",
  "linear-gradient(135deg,#8b5cf6,#ec4899)",
  "linear-gradient(135deg,#f43f5e,#fb923c)",
];
function gradientFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

/** A number that smoothly tweens from its previous value to the new one. */
function Tally({ value, prefix = "" }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    const from = prev.current;
    const to = value;
    prev.current = value;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min((t - start) / 900, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (to - from) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <>
      {prefix}
      {display.toLocaleString("en-US")}
    </>
  );
}

function Pill({ d }: { d: Feed["recent"][number] }) {
  return (
    <span className="mr-3 inline-flex shrink-0 items-center gap-2.5 rounded-full border border-border/70 bg-card/80 py-1.5 pl-1.5 pr-4">
      <span
        className="flex size-7 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ backgroundImage: gradientFor(d.name) }}
      >
        {(d.name || "?").charAt(0).toUpperCase()}
      </span>
      <span className="whitespace-nowrap text-sm">
        <span className="font-semibold">{d.name}</span>{" "}
        <span className="text-muted-foreground">donated</span>{" "}
        <span className="font-semibold text-primary">
          {d.amount != null ? formatCurrency(d.amount) : `${formatNumber(d.pads ?? 0)} pads`}
        </span>
      </span>
    </span>
  );
}

export function LiveDonationWall({ initial }: { initial: Feed }) {
  const [feed, setFeed] = useState<Feed>(initial);
  const [pulse, setPulse] = useState(false);
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
          setPulse(true);
          setTimeout(() => alive && setPulse(false), 1600);
        }
        setFeed(next);
      } catch {
        /* keep last good data */
      }
    }
    const t = setInterval(pull, 10000);
    pull();
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const stats = [
    { icon: Coins, label: "Raised", value: feed.counters.moneyRaised, prefix: "TSh ", hero: true },
    { icon: Droplets, label: "Pads sponsored", value: feed.counters.padsSponsored },
    { icon: HeartHandshake, label: "Donations", value: feed.counters.donations },
    { icon: Users, label: "Donors", value: feed.counters.donors },
  ];

  // Build a wide "base" (repeat the feed until it can fill the bar), then
  // duplicate it once so the marquee (translateX -50%) loops seamlessly.
  const items = feed.recent;
  const base = items.length
    ? Array.from({ length: Math.max(items.length, 6) }, (_, i) => items[i % items.length])
    : [];
  const loop = base.length ? [...base, ...base] : [];
  const duration = `${Math.max(22, base.length * 5)}s`;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card/70 p-6 shadow-soft backdrop-blur-xl sm:p-7">
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent live-shimmer" />
      <span
        className={cn(
          "pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/20 blur-3xl transition-opacity duration-700",
          pulse ? "opacity-100" : "opacity-40",
        )}
      />

      <div className="relative flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Live donations</h3>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          Live
        </span>
      </div>

      {/* counters */}
      <div className="relative mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className={cn(
              "rounded-2xl border border-border/70 bg-muted/30 p-3.5 transition-all",
              pulse && "border-primary/40",
            )}
          >
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary transition-shadow",
                pulse && "shadow-glow",
              )}
            >
              <s.icon className="size-4" />
            </span>
            <p
              className={cn(
                "mt-2 font-display text-xl font-bold tracking-tight tabular-nums sm:text-2xl",
                s.hero && "text-gradient",
              )}
            >
              <Tally value={s.value} prefix={s.prefix} />
            </p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* scrolling live ticker — donations glide across, coming and going */}
      <div className="marquee-row relative mt-5 overflow-hidden rounded-2xl border border-border/70 bg-muted/20 py-2.5">
        {/* LIVE badge + left fade */}
        <span className="absolute left-0 top-0 z-20 flex h-full items-center gap-1.5 bg-gradient-to-r from-card via-card/95 to-transparent pl-3 pr-10 text-xs font-bold uppercase tracking-wide text-success">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          Live
        </span>
        {/* right fade */}
        <span className="pointer-events-none absolute right-0 top-0 z-20 h-full w-12 bg-gradient-to-l from-card to-transparent" />

        {loop.length === 0 ? (
          <p className="flex items-center gap-2 px-4 pl-20 text-sm text-muted-foreground">
            <Sparkles className="size-4 text-primary" />
            Be the first to donate — your gift scrolls across here instantly.
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
    </div>
  );
}
