"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;
const TAG = "Empowering every cycle";

/**
 * The opening, once per visit (owner, 2026-11-09: "a very nice animation of the logo — premium, bling"). Always night,
 * whatever the theme: a soft ORA-pink halo grows; the ORA mark rises through a curtain, sharpening from a blur; a pink
 * light sweeps across its lines; the line "Empowering every cycle" appears letter by letter; a counter runs to 100 with
 * a hairline filling the foot of the screen; then the whole panel lifts away like a curtain onto the hero.
 * Skipped for reduced-motion users and on a second visit in the same session (see SiteIntro).
 */
export function IntroAnimation() {
  const [done, setDone] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    if (root.hasAttribute("data-intro-seen") || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDone(true);
      return;
    }
    root.style.overflow = "hidden";
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 2300);
      setCount(Math.round((1 - Math.pow(1 - p, 3)) * 100));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const finish = () => {
      root.style.overflow = "";
      setDone(true);
    };
    const t = window.setTimeout(finish, 3000);
    const hard = window.setTimeout(finish, 6000); // never trap a visitor behind the curtain
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
      window.clearTimeout(hard);
      root.style.overflow = "";
    };
  }, []);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          key="intro"
          aria-hidden
          className="s-intro2 fixed inset-0 z-[90] overflow-hidden bg-[#0a0a0b] text-[#ece8e1]"
          exit={{ clipPath: "inset(0% 0% 100% 0%)" }}
          initial={{ clipPath: "inset(0% 0% 0% 0%)" }}
          transition={{ duration: 0.95, ease: [0.76, 0, 0.24, 1] }}
        >
          {/* the halo */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              className="size-[70vmin] rounded-full bg-[radial-gradient(circle,rgb(255_46_151/0.4),rgb(255_46_151/0.08)_45%,transparent_70%)]"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.8, ease: EASE }}
            />
          </div>

          <motion.div className="relative flex h-full flex-col items-center justify-center" exit={{ y: -60, opacity: 0 }} transition={{ duration: 0.6, ease: EASE }}>
            {/* the mark: rises through a curtain, sharpens, then a pink light sweeps across its lines */}
            <motion.div
              className="relative aspect-[150/250] h-[46vmin] max-h-[380px] min-h-[200px]"
              initial={{ clipPath: "inset(100% 0% 0% 0%)", filter: "blur(14px)", scale: 1.12 }}
              animate={{ clipPath: "inset(0% 0% 0% 0%)", filter: "blur(0px)", scale: 1 }}
              transition={{ duration: 1.3, ease: EASE, delay: 0.15 }}
            >
              <div
                className="s-intro-mark absolute inset-0"
                style={{
                  WebkitMaskImage: "url(/ora/logo.png)",
                  maskImage: "url(/ora/logo.png)",
                  WebkitMaskSize: "contain",
                  maskSize: "contain",
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                  WebkitMaskPosition: "center",
                  maskPosition: "center",
                }}
              />
            </motion.div>

            {/* the line, letter by letter */}
            <motion.p
              className="mt-9 flex font-site-mono text-[11px] uppercase text-[#ece8e1]/75 sm:text-xs"
              initial={{ letterSpacing: "0.6em" }}
              animate={{ letterSpacing: "0.32em" }}
              transition={{ duration: 1.6, ease: EASE, delay: 0.9 }}
            >
              {TAG.split("").map((ch, i) => (
                <motion.span key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.95 + i * 0.03, duration: 0.5, ease: EASE }}>
                  {ch === " " ? " " : ch}
                </motion.span>
              ))}
            </motion.p>
          </motion.div>

          {/* foot: label, counter and the filling hairline */}
          <div className="absolute inset-x-0 bottom-0 px-[clamp(1.25rem,5vw,5rem)] pb-[max(1.5rem,var(--sab))]">
            <div className="flex items-end justify-between gap-6">
              <motion.span className="s-label text-[#ece8e1]/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.8 }}>
                [ ORA Pads ] — Tanzania
              </motion.span>
              <span className="font-site-display text-[clamp(2.6rem,7vw,5.5rem)] font-semibold leading-none tracking-[-0.05em] tabular-nums">
                {String(count).padStart(3, "0")}
              </span>
            </div>
            <div className="mt-4 h-px w-full bg-[#ece8e1]/10">
              <div className="h-full origin-left bg-[rgb(255_46_151)]" style={{ transform: `scaleX(${count / 100})` }} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
