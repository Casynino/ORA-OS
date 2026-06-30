"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { Feed, FeedItem } from "@/components/public/live-donation-feed";

const VISIBLE = 2;
const POOL_MAX = 24;
const EMIT_MS = 3200;
const POLL_MS = 6000;

// Warm, loving one-liners — chosen per gift so each donor keeps theirs.
const TEMPLATES = [
  (n: string) => `Some love from ${n}`,
  (n: string) => `${n} shared love`,
  (n: string) => `A gift from ${n}`,
  (n: string) => `${n} sent love`,
  (n: string) => `Kindness from ${n}`,
  (n: string) => `With love, ${n}`,
];
function love(id: string, name: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TEMPLATES[h % TEMPLATES.length](name);
}
function gift(d: FeedItem) {
  return d.amount != null ? formatCurrency(d.amount) : `${formatNumber(d.pads ?? 0)} pads`;
}

type Card = { key: number; item: FeedItem };

export function HomeLiveActivity({ initial }: { initial: Feed }) {
  const [cards, setCards] = useState<Card[]>([]);
  const pool = useRef<FeedItem[]>(initial.recent.slice(0, POOL_MAX));
  const cursor = useRef(0);
  const keyId = useRef(0);
  const seen = useRef(new Set(initial.recent.map((d) => d.id)));

  useEffect(() => {
    const p = pool.current;
    if (!p.length) return;
    const n = Math.min(VISIBLE, p.length);
    setCards(p.slice(0, n).reverse().map((item) => ({ key: ++keyId.current, item })));
    cursor.current = n % p.length;
  }, []);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      const p = pool.current;
      if (p.length) {
        const item = p[cursor.current % p.length];
        cursor.current = (cursor.current + 1) % p.length;
        setCards((prev) => [...prev, { key: ++keyId.current, item }].slice(-VISIBLE));
      }
      if (alive) timer = setTimeout(loop, EMIT_MS + (Math.random() - 0.3) * 1200);
    };
    timer = setTimeout(loop, EMIT_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    async function pull() {
      try {
        const res = await fetch("/api/donations/feed", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const next: Feed = await res.json();
        if (!alive) return;
        const fresh = next.recent.filter((d) => !seen.current.has(d.id));
        if (fresh.length) {
          fresh.forEach((d) => seen.current.add(d.id));
          pool.current = [...fresh, ...pool.current].slice(0, POOL_MAX);
          cursor.current = 0;
          setCards((prev) => [...prev, { key: ++keyId.current, item: fresh[0] }].slice(-VISIBLE));
        }
      } catch {
        /* keep last good */
      }
    }
    const t = setInterval(pull, POLL_MS);
    pull();
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (!pool.current.length) return null;

  return (
    <div className="flex flex-col items-stretch gap-2">
      <AnimatePresence initial={false}>
        {cards.map((c) => (
          <motion.div
            key={c.key}
            layout
            initial={{ opacity: 0, y: 14, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 200, damping: 24 }}
          >
            <div
              className="flex items-center gap-2.5 rounded-full border border-white/10 bg-card/70 py-1.5 pl-1.5 pr-4 backdrop-blur-xl"
              style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 18px 40px -18px rgba(217,70,239,0.4)" }}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent">
                <Heart className="size-3.5 fill-white text-white" />
              </span>
              <span className="truncate text-[13px]">
                <span className="text-foreground/90">{love(c.item.id, c.item.name)}</span>
                <span className="text-muted-foreground"> · </span>
                <span className="font-semibold text-primary">{gift(c.item)}</span>
              </span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
