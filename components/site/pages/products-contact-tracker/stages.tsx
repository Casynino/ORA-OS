"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { products } from "@/lib/products";
import { EASE } from "@/components/site/motion";
import { ArrowDisc, Drops, packFor } from "./shared";

/*
 * The moving product scenes of the Products and Product pages: the three packs floating at different depths over
 * their sizes sliding past in outline; the "find your fit" index whose pack changes as you point at a need; and the
 * single pack turning in over its own size on a product page. Transforms only, so it stays smooth on phones.
 */

// Where each pack sits: on a phone they cascade down a square stage, on wider screens they fan out side by side.
const LINEUP = [
  { m: ["0%", "3%", "62%"], d: ["0%", "24%", "42%"], z: 10, r0: "-11deg", r1: "-7deg", depth: 0.7, dur: "7s", delay: "0s" },
  { m: ["34%", "29%", "66%"], d: ["27%", "2%", "46%"], z: 20, r0: "3deg", r1: "-2deg", depth: 1.2, dur: "6s", delay: "-2s" },
  { m: ["3%", "55%", "40%"], d: ["70%", "20%", "30%"], z: 30, r0: "9deg", r1: "13deg", depth: 0.45, dur: "8s", delay: "-4s" },
];
const AMP = 55;

/** The three packs, floating at different depths, with their sizes sliding past behind them. */
export function PackLineup() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const run = useTransform(scrollYProgress, [0, 1], ["0%", "-30%"]);
  const ys = [
    useTransform(scrollYProgress, [0, 1], [AMP * LINEUP[0].depth, -AMP * LINEUP[0].depth]),
    useTransform(scrollYProgress, [0, 1], [AMP * LINEUP[1].depth, -AMP * LINEUP[1].depth]),
    useTransform(scrollYProgress, [0, 1], [AMP * LINEUP[2].depth, -AMP * LINEUP[2].depth]),
  ];

  return (
    <section ref={ref} aria-label="The three ORA packs" className="relative isolate overflow-hidden pb-14 pt-4 sm:pb-20">
      <motion.p
        aria-hidden
        style={{ x: reduce ? 0 : run }}
        className="pointer-events-none absolute left-0 top-[16%] -z-10 whitespace-nowrap font-site-display text-[clamp(7rem,24vw,24rem)] font-semibold leading-none tracking-[-0.05em] s-outline"
      >
        360 · 290 · 180 · 360 · 290 · 180
      </motion.p>
      <div className="relative mx-auto max-w-[1440px] px-5 sm:px-8">
        <div className="relative mx-auto aspect-square w-full max-w-[1120px] sm:aspect-[16/9]">
          {products.map((p, k) => {
            const l = LINEUP[k] ?? LINEUP[0];
            const pack = packFor(p);
            return (
              <motion.div
                key={p.slug}
                className="absolute left-[var(--lm)] top-[var(--tm)] w-[var(--wm)] sm:left-[var(--ld)] sm:top-[var(--td)] sm:w-[var(--wd)]"
                style={{
                  ["--lm" as string]: l.m[0],
                  ["--tm" as string]: l.m[1],
                  ["--wm" as string]: l.m[2],
                  ["--ld" as string]: l.d[0],
                  ["--td" as string]: l.d[1],
                  ["--wd" as string]: l.d[2],
                  zIndex: l.z,
                  y: reduce ? 0 : ys[k] ?? 0,
                }}
              >
                <div aria-hidden className="absolute inset-[8%] -z-10 rounded-full blur-[60px] sm:blur-[80px]" style={{ background: `rgb(${pack.glow} / 0.42)` }} />
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 80, rotate: k === 1 ? 0 : k === 0 ? -14 : 14, scale: 0.88 }}
                  whileInView={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
                  viewport={{ once: true, margin: "-10% 0px" }}
                  transition={{ duration: 1.1, delay: 0.1 + k * 0.12, ease: EASE }}
                >
                  <Link href={`/products/${p.slug}`} className="group block outline-none" aria-label={`ORA ${p.use.toLowerCase()} pack, ${p.size}`}>
                    <div
                      className="s-float"
                      style={{
                        ["--dur" as string]: l.dur,
                        ["--delay" as string]: l.delay,
                        ["--r0" as string]: l.r0,
                        ["--r1" as string]: l.r1,
                        ["--amp" as string]: "-16px",
                      }}
                    >
                      <Image
                        src={pack.src}
                        alt=""
                        width={pack.w}
                        height={pack.h}
                        sizes="(max-width: 640px) 66vw, 520px"
                        className="h-auto w-full drop-shadow-[0_36px_44px_rgba(0,0,0,0.55)] transition-transform duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-2 group-hover:scale-105 group-focus-visible:scale-105"
                      />
                    </div>
                  </Link>
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        {/* the legend under the stage */}
        <ul className="mx-auto mt-10 grid max-w-[1120px] grid-cols-3 border-t border-white/10 sm:mt-6">
          {products.map((p, k) => (
            <li key={p.slug} className={k > 0 ? "border-l border-white/10" : undefined}>
              <Link href={`/products/${p.slug}`} className="group block px-2 pt-5 sm:px-6">
                <span className="s-label text-[rgb(var(--s-pink))]">0{k + 1}</span>
                <span className="mt-3 block font-site-display text-[clamp(1.25rem,3.4vw,2.6rem)] font-semibold leading-none tracking-[-0.04em] transition-colors duration-300 group-hover:text-[rgb(var(--s-pink))]">
                  {p.size.replace("mm", "")}
                  <span className="font-site-serif text-[0.6em] italic text-white/60">mm</span>
                </span>
                <span className="mt-2 block s-label">{p.use}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Pick by need: the needs are big outlined lines that fill as you point at them; the pack beside them changes. */
export function FitIndex() {
  const [a, setA] = useState(0);
  const reduce = useReducedMotion();
  const p = products[a];
  const pack = packFor(p);
  return (
    <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14">
      <ul className="border-t border-white/10">
        {products.map((q, i) => {
          const qp = packFor(q);
          return (
            <li key={q.slug}>
              <Link
                href={`/products/${q.slug}`}
                onMouseEnter={() => setA(i)}
                onFocus={() => setA(i)}
                className="group relative isolate grid grid-cols-[minmax(0,1fr)_auto] items-center gap-5 overflow-hidden border-b border-white/10 py-7 outline-none focus-visible:bg-white/[0.04] sm:py-9 lg:pr-4"
              >
                <span aria-hidden className="absolute inset-0 -z-10 origin-left scale-x-0 bg-white/[0.035] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100" />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 s-label">
                    <span className="text-[rgb(var(--s-pink))]">0{i + 1}</span>
                    <span>{q.size}</span>
                    <span>{q.use}</span>
                  </span>
                  <span
                    className={`mt-4 block font-site-display text-[clamp(1.55rem,3.6vw,3.3rem)] font-semibold uppercase leading-[0.98] tracking-[-0.03em] transition-[color,transform,-webkit-text-stroke-color] duration-300 ${
                      a === i ? "text-white lg:translate-x-2" : "text-white lg:text-transparent lg:[-webkit-text-stroke:1px_rgb(247_239_246/0.35)]"
                    }`}
                  >
                    {q.bestFor}
                  </span>
                </span>
                <span className="relative block w-20 shrink-0 sm:w-28 lg:hidden">
                  <Image src={qp.src} alt="" width={qp.w} height={qp.h} sizes="112px" className="h-auto w-full drop-shadow-[0_14px_18px_rgba(0,0,0,0.5)]" />
                </span>
                <ArrowDisc className="hidden lg:grid" />
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="relative hidden lg:block">
        <div className="sticky top-28 h-[540px] overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.02]">
          <motion.div
            aria-hidden
            className="absolute left-1/2 top-[42%] size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[90px]"
            animate={{ backgroundColor: `rgb(${pack.glow} / 0.45)` }}
            transition={{ duration: 0.9 }}
          />
          <div aria-hidden className="absolute inset-x-8 top-8 flex items-center justify-between">
            <span className="s-label">Find your fit</span>
            <span className="s-label">0{a + 1} / 0{products.length}</span>
          </div>
          <div className="absolute inset-x-10 top-16 bottom-36 grid place-items-center">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={p.slug}
                initial={reduce ? false : { opacity: 0, x: 120, rotate: 14, scale: 0.85 }}
                animate={{ opacity: 1, x: 0, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, x: -120, rotate: -12, scale: 0.85 }}
                transition={{ duration: 0.7, ease: EASE }}
                className="w-[78%]"
              >
                <div className="s-float" style={{ ["--amp" as string]: "-14px", ["--dur" as string]: "6s" }}>
                  <Image src={pack.src} alt={`ORA ${p.use.toLowerCase()} pack, ${p.size}`} width={pack.w} height={pack.h} sizes="420px" className="h-auto w-full drop-shadow-[0_36px_50px_rgba(0,0,0,0.55)]" />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="absolute inset-x-8 bottom-8 grid grid-cols-3 border-t border-white/10 pt-5 text-sm">
            <div>
              <p className="s-label">Size</p>
              <p className="mt-2 font-site-display text-lg font-semibold tracking-[-0.02em]">{p.size}</p>
            </div>
            <div className="border-l border-white/10 pl-4">
              <p className="s-label">Per pack</p>
              <p className="mt-2 font-site-display text-lg font-semibold tracking-[-0.02em]">{p.padsPerPack}</p>
            </div>
            <div className="border-l border-white/10 pl-4">
              <p className="s-label">Absorbency</p>
              <Drops n={p.absorbency} color={p.colorHex} className="mt-2.5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One pack on its stage: it turns in over its own size in outline, floats, and keeps turning as the page scrolls. */
export function ProductStage({
  slug,
  image,
  size,
  length,
  padsPerPack,
  alt,
}: {
  slug: string;
  image: string;
  size: string;
  length: string;
  padsPerPack: number;
  alt: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const pack = packFor({ slug, image });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const turn = useTransform(scrollYProgress, [0, 1], [0, 14]);
  // it rises as the page scrolls on, so it never slides into the bottom edge of the opening
  const drop = useTransform(scrollYProgress, [0, 1], ["0%", "-14%"]);
  return (
    <div ref={ref} className="relative mx-auto aspect-square w-full max-w-[620px]">
      <div aria-hidden className="absolute inset-[14%] rounded-full blur-[70px] sm:blur-[90px]" style={{ background: `rgb(${pack.glow} / 0.5)` }} />
      <div aria-hidden className="absolute inset-[4%] rounded-full border border-dashed border-white/[0.12] motion-safe:animate-[spin_60s_linear_infinite]" />
      <div aria-hidden className="absolute inset-[16%] rounded-full border border-white/[0.07]" />
      <span
        aria-hidden
        className="absolute inset-0 grid place-items-center font-site-display text-[clamp(7rem,27vw,19rem)] font-semibold leading-none tracking-[-0.06em] s-outline"
      >
        {size.replace("mm", "")}
      </span>
      <motion.div style={{ rotate: reduce ? 0 : turn, y: reduce ? 0 : drop }} className="absolute inset-[6%] grid place-items-center">
        <motion.div
          initial={reduce ? false : { opacity: 0, x: 140, rotate: 18, scale: 0.82 }}
          animate={{ opacity: 1, x: 0, rotate: 0, scale: 1 }}
          transition={{ duration: 1.1, delay: 0.3, ease: EASE }}
          className="w-full"
        >
          <div className="s-float" style={{ ["--amp" as string]: "-18px", ["--dur" as string]: "6s", ["--r0" as string]: "-3deg", ["--r1" as string]: "2deg" }}>
            <Image src={pack.src} alt={alt} width={pack.w} height={pack.h} priority sizes="(max-width: 1024px) 88vw, 560px" className="h-auto w-full drop-shadow-[0_40px_60px_rgba(0,0,0,0.55)]" />
          </div>
        </motion.div>
      </motion.div>
      <span className="absolute left-0 top-[6%] s-label">Length · {length}</span>
      <span className="absolute bottom-[6%] right-0 s-label">{padsPerPack} per pack</span>
    </div>
  );
}
