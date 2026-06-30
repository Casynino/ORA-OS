"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, Coins, Droplets, HeartHandshake, Users } from "lucide-react";
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

const POOL_MAX = 24;
const EMIT_MS = 3000; // base pace; jittered per tick so it feels organic
const POLL_MS = 6000;

type Card = { key: number; item: FeedItem; isNew: boolean };

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
      const p = Math.min((t - start) / 1100, 1);
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

function relTime(at: string) {
  const s = (Date.now() - new Date(at).getTime()) / 1000;
  if (s < 75) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function DonationCard({ d, isNew, compact }: { d: FeedItem; isNew: boolean; compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border bg-card/60 backdrop-blur-md",
        compact ? "p-2.5" : "p-3 shadow-soft",
        isNew ? "border-primary/60 shadow-glow" : "border-border/50",
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white shadow-sm",
          compact ? "size-8" : "size-10",
        )}
      >
        <Heart className={cn("fill-white", compact ? "size-4" : "size-5", isNew && "animate-heart-beat")} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate font-semibold leading-tight", compact && "text-sm")}>
          {d.name}
        </p>
        <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
          {compact ? "" : "Donated "}
          <span className="font-semibold text-primary">
            {d.amount != null ? formatCurrency(d.amount) : `${formatNumber(d.pads ?? 0)} pads`}
          </span>
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 whitespace-nowrap text-muted-foreground",
          compact ? "text-[10px]" : "text-xs",
        )}
      >
        {relTime(d.at)}
      </span>
    </div>
  );
}

function FloatingHearts({ burst }: { burst: number }) {
  if (burst === 0) return null;
  return (
    <div key={burst} className="pointer-events-none absolute inset-x-0 bottom-3 z-20 h-20">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="float-heart absolute text-primary"
          style={{ left: `${42 + (i - 2.5) * 9}%`, animationDelay: `${i * 0.1}s` }}
        >
          <Heart className="size-4 fill-primary" style={{ opacity: 0.85 }} />
        </span>
      ))}
    </div>
  );
}

export function LiveDonationFeed({
  initial,
  showCounters = false,
  compact = false,
}: {
  initial: Feed;
  showCounters?: boolean;
  compact?: boolean;
}) {
  const visibleMax = compact ? 3 : 4;
  const [counters, setCounters] = useState(initial.counters);
  const [cards, setCards] = useState<Card[]>([]);
  const [burst, setBurst] = useState(0);

  const pool = useRef<FeedItem[]>(initial.recent.slice(0, POOL_MAX));
  const cursor = useRef(0);
  const keyId = useRef(0);
  const seen = useRef(new Set(initial.recent.map((d) => d.id)));

  // Seed the stack so it's never empty.
  useEffect(() => {
    const p = pool.current;
    if (!p.length) return;
    const n = Math.min(visibleMax, p.length);
    setCards(
      p.slice(0, n).reverse().map((item) => ({ key: ++keyId.current, item, isNew: false })),
    );
    cursor.current = n % p.length;
  }, [visibleMax]);

  // Organic heartbeat: a card flows in every ~EMIT_MS (± jitter).
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      const p = pool.current;
      if (p.length) {
        const item = p[cursor.current % p.length];
        cursor.current = (cursor.current + 1) % p.length;
        setCards((prev) =>
          [...prev, { key: ++keyId.current, item, isNew: false }].slice(-visibleMax),
        );
      }
      if (alive) timer = setTimeout(loop, EMIT_MS + (Math.random() - 0.3) * 1400);
    };
    timer = setTimeout(loop, EMIT_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [visibleMax]);

  // Poll NTZS for genuinely-new gifts + live counters.
  useEffect(() => {
    let alive = true;
    async function pull() {
      try {
        const res = await fetch("/api/donations/feed", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const next: Feed = await res.json();
        if (!alive) return;
        setCounters(next.counters);
        const fresh = next.recent.filter((d) => !seen.current.has(d.id));
        if (fresh.length) {
          fresh.forEach((d) => seen.current.add(d.id));
          pool.current = [...fresh, ...pool.current].slice(0, POOL_MAX);
          cursor.current = Math.min(fresh.length, pool.current.length) % pool.current.length;
          setCards((prev) =>
            [...prev, { key: ++keyId.current, item: fresh[0], isNew: true }].slice(-visibleMax),
          );
          setBurst((b) => b + 1);
        }
      } catch {
        /* keep last good data */
      }
    }
    const t = setInterval(pull, POLL_MS);
    pull();
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [visibleMax]);

  const stats = [
    { icon: Coins, label: "Raised", value: counters.moneyRaised, prefix: "TSh ", hero: true },
    { icon: Droplets, label: "Pads sponsored", value: counters.padsSponsored },
    { icon: HeartHandshake, label: "Donations", value: counters.donations },
    { icon: Users, label: "Donors", value: counters.donors },
  ];

  const stackH = compact ? "h-[150px]" : "h-[268px] sm:h-[296px]";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border bg-card/70 shadow-soft backdrop-blur-xl",
        compact ? "p-3.5" : "p-5 sm:p-6",
      )}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent live-shimmer" />
      <span className="pointer-events-none absolute -right-16 -top-16 size-44 rounded-full bg-primary/15 blur-3xl" />

      <div className="relative flex items-center justify-between">
        <h3 className={cn("font-display font-semibold", compact ? "text-sm" : "text-lg")}>
          {compact ? "Live activity" : "Live donations"}
        </h3>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full bg-success/10 font-semibold text-success",
            compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
          )}
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          Live
        </span>
      </div>

      {showCounters && !compact && (
        <div className="relative mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-border/60 bg-muted/30 p-3.5">
              <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
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
      )}

      <div className={cn("relative overflow-hidden", compact ? "mt-3" : "mt-4", stackH)}>
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-14 bg-gradient-to-b from-card via-card/70 to-transparent" />
        <FloatingHearts burst={burst} />
        <div className="flex h-full flex-col justify-end gap-2 px-0.5 pb-0.5">
          <AnimatePresence initial={false}>
            {cards.map((c) => (
              <motion.div
                key={c.key}
                layout
                initial={{ opacity: 0, scale: 0.96, y: 16, x: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -16, transition: { duration: 0.6, ease: "easeInOut" } }}
                transition={{ type: "spring", stiffness: 170, damping: 26, mass: 0.9 }}
              >
                <DonationCard d={c.item} isNew={c.isNew} compact={compact} />
              </motion.div>
            ))}
          </AnimatePresence>
          {cards.length === 0 && (
            <p className="flex items-center gap-2 rounded-2xl border border-dashed border-border p-3 text-sm text-muted-foreground">
              <Heart className="size-4 text-primary" />
              Be the first — your gift appears here the moment you donate.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
