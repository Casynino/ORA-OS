"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;
const TAG = "Empowering every cycle";
// Only the packs, no people (owner, 2026-11-09). Twelve packs stream out of the centre towards the viewer and past the
// edges, so it feels like flying into the ORA world. A golden-angle spread keeps any two from following the same line.
const PACK_SRC = [
  { src: "/ora/site/pack-night.webp", w: 1100, h: 716 },
  { src: "/ora/site/pack-day.webp", w: 1100, h: 817 },
  { src: "/ora/site/pack-liner.webp", w: 851, h: 895 },
];
const PACKS = Array.from({ length: 12 }, (_, k) => {
  const a = ((k * 137.5 + 20) * Math.PI) / 180;
  return { ...PACK_SRC[k % 3], dx: Math.cos(a), dy: Math.sin(a), rot: ((k * 47) % 30) - 15, delay: (k * 0.21) % 2.5 };
});
const FLIGHT = 2.6;
// the packs fade out over the mark and its line, so they come out from behind it and never cross the logo or the words
const PACK_CLEAR = "radial-gradient(ellipse clamp(190px,30vmin,300px) clamp(220px,38vmin,380px) at 50% 48%, transparent 60%, #000 100%)";

/**
 * The opening, once per visit (owner, 2026-11-09: "a very nice animation of the logo — premium, bling"). Always night,
 * whatever the theme: ORA packs stream towards the viewer out of the middle; a soft ORA-pink halo grows; the ORA mark rises through a curtain, sharpening from a blur; a pink
 * light sweeps across its lines; the line "Empowering every cycle" appears letter by letter; a counter runs to 100 with
 * a hairline filling the foot of the screen; then the whole panel lifts away like a curtain onto the hero.
 * Skipped for reduced-motion users and on a second visit in the same session (see SiteIntro).
 */
export function IntroAnimation() {
  const [done, setDone] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    // "?intro" in the address holds the opening on screen (for previewing it); it is never linked anywhere
    const hold = new URLSearchParams(window.location.search).has("intro");
    if (hold) root.removeAttribute("data-intro-seen");
    if (!hold && (root.hasAttribute("data-intro-seen") || window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
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
    const t = hold ? 0 : window.setTimeout(finish, 3000);
    const hard = hold ? 0 : window.setTimeout(finish, 6000); // never trap a visitor behind the curtain
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
          className="s-intro2 fixed inset-0 z-[90] overflow-hidden bg-[radial-gradient(ellipse_80%_70%_at_50%_45%,#2a0c22_0%,#140812_42%,#0a0a0b_78%)] text-[#ece8e1]"
          exit={{ clipPath: "inset(0% 0% 100% 0%)" }}
          initial={{ clipPath: "inset(0% 0% 0% 0%)" }}
          transition={{ duration: 0.95, ease: [0.76, 0, 0.24, 1] }}
        >
          {/* specks of light drifting up through the scene */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {Array.from({ length: 34 }, (_, k) => (
              <span
                key={k}
                className="s-speck absolute rounded-full"
                style={{
                  left: `${(k * 37 + 11) % 100}%`,
                  bottom: `${(k * 53) % 40 - 10}%`,
                  width: `${2 + (k % 3)}px`,
                  height: `${2 + (k % 3)}px`,
                  background: k % 3 === 0 ? "rgb(255 46 151)" : "rgb(242 236 228)",
                  animationDuration: `${5 + (k % 5)}s`,
                  animationDelay: `${-((k * 0.7) % 5)}s`,
                }}
              />
            ))}
          </div>

          {/* fine frame marks in the corners */}
          {["left-5 top-5 border-l border-t", "right-5 top-5 border-r border-t", "left-5 bottom-5 border-l border-b", "right-5 bottom-5 border-r border-b"].map((c) => (
            <motion.span key={c} aria-hidden className={`absolute size-6 border-[#ece8e1]/30 sm:size-8 ${c}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 1 }} />
          ))}

          {/* the packs: each starts small and far away in the middle, then grows as it rushes out past the edges of the
              screen, one after another without a break, like entering the ORA world */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ WebkitMaskImage: PACK_CLEAR, maskImage: PACK_CLEAR }}>
            {PACKS.map((p, k) => (
              <div key={k} className="absolute left-1/2 top-[45%]">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{
                    x: [`${p.dx * 5}vw`, `${p.dx * 66}vw`],
                    y: [`${p.dy * 5}vh`, `${p.dy * 62}vh`],
                    scale: [0.1, 1.75],
                    rotate: [p.rot * 0.25, p.rot],
                    opacity: [0, 1, 1, 0],
                  }}
                  transition={{
                    default: { duration: FLIGHT, ease: [0.55, 0, 0.9, 0.45], delay: p.delay, repeat: Infinity },
                    opacity: { duration: FLIGHT, ease: "linear", times: [0, 0.22, 0.82, 1], delay: p.delay, repeat: Infinity },
                  }}
                >
                  <div className="w-[clamp(104px,17vmin,210px)] -translate-x-1/2 -translate-y-1/2">
                    <Image src={p.src} alt="" width={p.w} height={p.h} sizes="210px" className="h-auto w-full" />
                  </div>
                </motion.div>
              </div>
            ))}
          </div>

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
            {/* rings in the shape of the ORA arch draw themselves around the mark, one after another */}
            <div className="relative flex items-center justify-center [--h:clamp(200px,46vmin,380px)]">
            <svg aria-hidden viewBox="-100 -100 200 200" className="pointer-events-none absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2" style={{ width: "calc(var(--h) * 2)", height: "calc(var(--h) * 2)", WebkitMaskImage: "linear-gradient(to bottom, #000 52%, transparent 70%)", maskImage: "linear-gradient(to bottom, #000 52%, transparent 70%)" }}>
              {[0, 1, 2, 3, 4, 5].map((k) => {
                const w = 50 + k * 17;
                const h = 92 + k * 17;
                return (
                  <motion.rect
                    key={k}
                    x={-w / 2}
                    y={-h / 2}
                    width={w}
                    height={h}
                    rx={w / 2}
                    fill="none"
                    stroke={k === 0 ? "rgb(255 46 151)" : "rgb(242 236 228)"}
                    strokeWidth={k === 0 ? 0.45 : 0.3}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: k === 0 ? 0.7 : 0.38 - k * 0.055 }}
                    transition={{ pathLength: { duration: 1.6, ease: EASE, delay: 0.35 + k * 0.13 }, opacity: { duration: 0.4, delay: 0.35 + k * 0.13 } }}
                  />
                );
              })}
            </svg>
            {/* the mark: rises through a curtain, sharpens, then a pink light sweeps across its lines; a soft pink glow
                around the lines (on a wrapper, so the curtain does not clip it) */}
            <div className="relative [filter:drop-shadow(0_0_14px_rgb(255_46_151/0.4))_drop-shadow(0_0_1px_rgb(255_240_248/0.45))]">
            <motion.div
              className="relative aspect-[150/250] h-[var(--h)]"
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
            </div>
            </div>

            {/* the line, letter by letter */}
            <motion.p
              className="mt-9 flex font-site-mono text-[11px] uppercase text-[#ece8e1]/80 [text-shadow:0_0_14px_rgb(10_4_10),0_0_4px_rgb(10_4_10)] sm:text-xs"
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
