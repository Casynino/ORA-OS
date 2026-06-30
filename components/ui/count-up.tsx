"use client";

import { useEffect, useRef, useState } from "react";

/** Animated number that counts up when it scrolls into view. */
export function CountUp({
  value,
  duration = 1.8,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const run = () => {
      if (started.current) return;
      started.current = true;
      let raf = 0;
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min((t - start) / (duration * 1000), 1);
        const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
        setN(Math.round(value * eased));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    // Reliable native observer — fires for elements that scroll into view.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          run();
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);

    // Fallback: if it's already in the viewport on mount, start right away
    // (covers cases where the observer's initial callback is missed).
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) run();

    return () => io.disconnect();
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {n.toLocaleString("en-US")}
      {suffix}
    </span>
  );
}
