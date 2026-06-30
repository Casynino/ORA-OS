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

const MAX_CARDS = 4;
const POLL_MS = 4000;

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

function DonationCard({ d, fresh }: { d: FeedItem; fresh: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border bg-card/60 p-3 shadow-soft backdrop-blur-md transition-shadow",
        fresh ? "border-primary/50 shadow-glow" : "border-border/60",
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white shadow-sm">
        <Heart className={cn("size-5 fill-white", fresh && "animate-heart-beat")} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold leading-tight">{d.name}</p>
        <p className="text-sm text-muted-foreground">
          Donated{" "}
          <span className="font-semibold text-primary">
            {d.amount != null ? formatCurrency(d.amount) : `${formatNumber(d.pads ?? 0)} pads`}
          </span>
        </p>
      </div>
      <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
        {relTime(d.at)}
      </span>
    </div>
  );
}

/** Soft floating hearts that rise once when a new gift lands. */
function FloatingHearts({ burst }: { burst: number }) {
  if (burst === 0) return null;
  const hearts = [0, 1, 2, 3, 4, 5];
  return (
    <div key={burst} className="pointer-events-none absolute inset-x-0 bottom-3 z-20 h-20">
      {hearts.map((i) => (
        <span
          key={i}
          className="float-heart absolute text-primary"
          style={{
            left: `${42 + (i - 2.5) * 9}%`,
            animationDelay: `${i * 0.09}s`,
          }}
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
}: {
  initial: Feed;
  showCounters?: boolean;
}) {
  const [counters, setCounters] = useState(initial.counters);
  // Stack is oldest → newest (newest at the bottom).
  const [cards, setCards] = useState<FeedItem[]>(() =>
    initial.recent.slice(0, MAX_CARDS).reverse(),
  );
  const [freshId, setFreshId] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const seen = useRef<Set<string>>(new Set(initial.recent.map((d) => d.id)));

  useEffect(() => {
    let alive = true;
    async function pull() {
      try {
        const res = await fetch("/api/donations/feed", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const next: Feed = await res.json();
        if (!alive) return;
        setCounters(next.counters);
        // New donations are at the front of recent (newest-first); take the
        // ones we haven't shown yet, oldest-first, and stack them in.
        const fresh = next.recent.filter((d) => !seen.current.has(d.id)).reverse();
        if (fresh.length) {
          fresh.forEach((d) => seen.current.add(d.id));
          setCards((prev) => [...prev, ...fresh].slice(-MAX_CARDS));
          const newest = fresh[fresh.length - 1];
          setFreshId(newest.id);
          setBurst((b) => b + 1);
          setTimeout(() => alive && setFreshId(null), 2600);
        } else {
          // keep relative times ("Just now" → "1m ago") fresh
          setCards((prev) => [...prev]);
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
  }, []);

  const stats = [
    { icon: Coins, label: "Raised", value: counters.moneyRaised, prefix: "TSh ", hero: true },
    { icon: Droplets, label: "Pads sponsored", value: counters.padsSponsored },
    { icon: HeartHandshake, label: "Donations", value: counters.donations },
    { icon: Users, label: "Donors", value: counters.donors },
  ];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card/70 p-5 shadow-soft backdrop-blur-xl sm:p-6">
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent live-shimmer" />
      <span
        className={cn(
          "pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/20 blur-3xl transition-opacity duration-700",
          freshId ? "opacity-100" : "opacity-40",
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

      {showCounters && (
        <div className="relative mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className={cn(
                "rounded-2xl border border-border/70 bg-muted/30 p-3.5 transition-all",
                freshId && "border-primary/40",
              )}
            >
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary transition-shadow",
                  freshId && "shadow-glow",
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
      )}

      {/* live activity stack — newest pops in at the bottom, older float up */}
      <div className="relative mt-4 h-[268px] overflow-hidden sm:h-[300px]">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-14 bg-gradient-to-b from-card/90 to-transparent" />
        <FloatingHearts burst={burst} />
        <div className="flex h-full flex-col justify-end gap-2.5 px-0.5">
          <AnimatePresence initial={false}>
            {cards.map((d) => (
              <motion.div
                key={d.id}
                layout
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -12, transition: { duration: 0.45 } }}
                transition={{ type: "spring", stiffness: 240, damping: 22 }}
              >
                <DonationCard d={d} fresh={d.id === freshId} />
              </motion.div>
            ))}
          </AnimatePresence>
          {cards.length === 0 && (
            <p className="flex items-center gap-2 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              <Heart className="size-4 text-primary" />
              Be the first — your gift appears here the moment you donate.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
