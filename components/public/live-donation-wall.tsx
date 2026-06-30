"use client";

import { useEffect, useRef, useState } from "react";
import { HeartHandshake, Coins, Droplets, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { TickerStrip, type Feed } from "@/components/public/donation-ticker";

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
          setTimeout(() => alive && setPulse(false), 1800);
        }
        setFeed(next);
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

  const stats = [
    { icon: Coins, label: "Raised", value: feed.counters.moneyRaised, prefix: "TSh ", hero: true },
    { icon: Droplets, label: "Pads sponsored", value: feed.counters.padsSponsored },
    { icon: HeartHandshake, label: "Donations", value: feed.counters.donations },
    { icon: Users, label: "Donors", value: feed.counters.donors },
  ];

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

      <div className="relative mt-5">
        <TickerStrip items={feed.recent} glow={pulse} />
      </div>
    </div>
  );
}
