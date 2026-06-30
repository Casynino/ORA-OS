"use client";

import { useEffect, useRef, useState } from "react";
import { HeartHandshake, Coins, Droplets, Users, Sparkles } from "lucide-react";
import { cn, formatCurrency, formatNumber, timeAgo } from "@/lib/utils";

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
    const dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min((t - start) / dur, 1);
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

export function LiveDonationWall({ initial }: { initial: Feed }) {
  const [feed, setFeed] = useState<Feed>(initial);
  const [newId, setNewId] = useState<string | null>(null);
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
          setNewId(top);
          setPulse(true);
          setTimeout(() => alive && setNewId(null), 6000);
          setTimeout(() => alive && setPulse(false), 1200);
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

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card/70 p-6 shadow-soft backdrop-blur-xl sm:p-7">
      {/* animated top accent line */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent live-shimmer" />
      {/* ambient glow that breathes when a gift lands */}
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
              "group rounded-2xl border border-border/70 bg-muted/30 p-3.5 transition-all",
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

      {/* feed */}
      <div className="relative mt-5 space-y-2">
        {feed.recent.length === 0 ? (
          <p className="flex items-center gap-2 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            <Sparkles className="size-4 text-primary" />
            Be the first to donate — your gift appears here instantly.
          </p>
        ) : (
          feed.recent.map((d) => {
            const isNew = d.id === newId;
            const initial = (d.name || "?").charAt(0).toUpperCase();
            return (
              <div
                key={d.id}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 text-sm transition-all duration-500",
                  isNew
                    ? "donation-pop border-success/60 bg-success/10 shadow-glow"
                    : "border-border/70 bg-card hover:border-primary/30",
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="relative shrink-0">
                    {isNew && (
                      <span className="absolute inset-0 animate-ping rounded-full bg-success/50" />
                    )}
                    <span
                      className="relative flex size-9 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
                      style={{ backgroundImage: gradientFor(d.name) }}
                    >
                      {initial}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">
                      <span className="font-semibold">{d.name}</span>{" "}
                      <span className="text-muted-foreground">donated</span>{" "}
                      <span className="font-semibold text-primary">
                        {d.amount != null
                          ? formatCurrency(d.amount)
                          : `${formatNumber(d.pads ?? 0)} pads`}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">{timeAgo(d.at)}</span>
                  </span>
                </span>
                {isNew ? (
                  <span className="shrink-0 animate-pulse rounded-full bg-success px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    New
                  </span>
                ) : (
                  <HeartHandshake className="size-4 shrink-0 text-primary/40" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
