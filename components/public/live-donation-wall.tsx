"use client";

import { useEffect, useRef, useState } from "react";
import { HeartHandshake, Coins, Droplets, Users, Activity } from "lucide-react";
import { cn, formatCurrency, formatNumber, timeAgo } from "@/lib/utils";

type Feed = {
  counters: { moneyRaised: number; padsSponsored: number; donations: number; donors: number };
  recent: { id: string; name: string; amount: number | null; pads: number | null; at: string }[];
};

export function LiveDonationWall({ initial }: { initial: Feed }) {
  const [feed, setFeed] = useState<Feed>(initial);
  const [flash, setFlash] = useState<string | null>(null);
  const topId = useRef(initial.recent[0]?.id ?? null);

  useEffect(() => {
    let alive = true;
    async function pull() {
      try {
        const res = await fetch("/api/donations/feed", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const next: Feed = await res.json();
        if (!alive) return;
        const newTop = next.recent[0]?.id ?? null;
        if (newTop && newTop !== topId.current) {
          topId.current = newTop;
          setFlash(newTop);
          setTimeout(() => alive && setFlash(null), 2500);
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
    { icon: Coins, label: "Raised", value: formatCurrency(feed.counters.moneyRaised) },
    { icon: Droplets, label: "Pads sponsored", value: formatNumber(feed.counters.padsSponsored) },
    { icon: HeartHandshake, label: "Donations", value: formatNumber(feed.counters.donations) },
    { icon: Users, label: "Donors", value: formatNumber(feed.counters.donors) },
  ];

  return (
    <div className="glass-card rounded-3xl p-6 sm:p-7">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Live donations</h3>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
          <span className="size-1.5 animate-pulse rounded-full bg-success" />
          Live
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-muted/40 p-3">
            <s.icon className="size-4 text-primary" />
            <p className="mt-1.5 font-display text-lg font-bold tracking-tight">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 space-y-2">
        {feed.recent.length === 0 ? (
          <p className="flex items-center gap-2 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            <Activity className="size-4" />
            Be the first to donate — your gift appears here instantly.
          </p>
        ) : (
          feed.recent.map((d) => (
            <div
              key={d.id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm transition-colors",
                flash === d.id
                  ? "border-success/50 bg-success/10"
                  : "border-border bg-card",
              )}
            >
              <span className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <HeartHandshake className="size-4" />
                </span>
                <span>
                  <span className="font-semibold">{d.name}</span>{" "}
                  <span className="text-muted-foreground">
                    donated{" "}
                    {d.amount != null
                      ? formatCurrency(d.amount)
                      : `${formatNumber(d.pads ?? 0)} pads`}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(d.at)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
