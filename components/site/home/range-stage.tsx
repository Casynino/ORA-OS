"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Droplet } from "lucide-react";
import { products } from "@/lib/products";
import { SectionLabel, SplitText, EASE } from "@/components/site/motion";

/* ORA's own studio packshots (clean, lit, styled with flowers) — not cut-outs (owner, 2026-11-09: the cut edges showed). */
const SHOT: Record<string, { src: string; glow: string; name: string }> = {
  "night-360": { src: "/ora/site/shot-night.jpg", glow: "123 97 255", name: "Night" },
  "day-290": { src: "/ora/site/shot-day.jpg", glow: "56 189 248", name: "Day" },
  "liner-180": { src: "/ora/site/shot-liner.jpg", glow: "255 77 189", name: "Liner" },
};

/**
 * The range as a stage. On a computer the section holds while you scroll: each pack's studio photograph opens in a tall
 * arch with a curtain, the light behind it takes the pack's colour, and its size, use and details change beside it.
 * Nothing spins or floats. On a phone the three packs are photo cards.
 */
export function RangeStage() {
  return (
    <section id="products" className="relative scroll-mt-16">
      <div className="mx-auto max-w-[1440px] px-5 pt-24 sm:px-8 sm:pt-32">
        <SectionLabel index="02" label="The range" aside="3 sizes · 100% air breathable" />
        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-end">
          <SplitText
            text="Protection that fits your flow"
            accent={["flow"]}
            className="font-site-display text-[clamp(2.2rem,5.4vw,5.2rem)] font-semibold uppercase leading-[0.95] tracking-[-0.03em] [&_.font-site-serif]:normal-case [&_.font-site-serif]:text-[1.1em]"
          />
          <p className="max-w-md text-[17px] leading-relaxed text-white/65">
            Designed for comfort, protection and everyday confidence. 100% air breathable, long-lasting freshness — in
            three sizes for every day of the cycle.
          </p>
        </div>
      </div>
      <Desktop />
      <Mobile />
    </section>
  );
}

function Drops({ n }: { n: number }) {
  return (
    <span className="flex items-center gap-1" aria-label={`Absorbency ${n} of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Droplet key={i} className={`size-4 ${i < n ? "fill-current text-[rgb(var(--s-pink))]" : "text-white/25"}`} strokeWidth={1.5} />
      ))}
    </span>
  );
}

function Desktop() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [i, setI] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setI(Math.min(products.length - 1, Math.floor(v * products.length * 0.999))));
  const rail = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  const p = products[i];
  const shot = SHOT[p.slug];

  return (
    <div ref={ref} className="relative hidden lg:block" style={{ height: `${products.length * 100}vh` }}>
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <motion.div
          aria-hidden
          className="absolute right-[6%] top-1/2 size-[44vw] -translate-y-1/2 rounded-full blur-[120px]"
          animate={{ backgroundColor: `rgb(${shot.glow} / 0.38)` }}
          transition={{ duration: 0.9 }}
        />
        <div className="relative mx-auto grid w-full max-w-[1440px] grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-16 px-8 pt-16">
          <div className="relative">
            <div className="flex items-baseline gap-4">
              <span className="font-site-display text-[8rem] font-semibold leading-none tracking-[-0.05em] s-outline">0{i + 1}</span>
              <span className="s-label">/ 0{products.length}</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={p.slug} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }} transition={{ duration: 0.55, ease: EASE }}>
                <p className="mt-6 s-label text-[rgb(var(--s-pink))]">{p.use} · {p.color}</p>
                <h3 className="mt-3 font-site-display text-[5.2rem] font-semibold uppercase leading-[0.9] tracking-[-0.04em]">
                  {p.size.replace("mm", "")}
                  <span className="font-site-serif text-[0.6em] normal-case italic text-white/70">mm</span>
                </h3>
                <p className="mt-4 font-site-serif text-3xl italic text-white/85">{p.tagline}</p>
                <dl className="mt-8 grid max-w-md grid-cols-3 border-y border-white/10 text-sm">
                  <div className="py-4 pr-3"><dt className="s-label">Length</dt><dd className="mt-2 text-white/90">{p.length}</dd></div>
                  <div className="border-l border-white/10 px-4 py-4"><dt className="s-label">Per pack</dt><dd className="mt-2 text-white/90">{p.padsPerPack} pads</dd></div>
                  <div className="border-l border-white/10 py-4 pl-4"><dt className="s-label">Absorbency</dt><dd className="mt-2"><Drops n={p.absorbency} /></dd></div>
                </dl>
                <p className="mt-5 max-w-md text-[15px] text-white/60">Best for: {p.bestFor.toLowerCase()}</p>
                <Link href={`/products/${p.slug}`} className="group mt-8 inline-flex items-center gap-2 text-[15px] font-medium text-white">
                  Discover the {shot.name.toLowerCase()} pack
                  <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={1.5} />
                </Link>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="relative mx-auto aspect-[4/5] h-[min(72vh,640px)]">
            <div aria-hidden className="s-arch absolute -inset-4 border border-white/15" />
            <div aria-hidden className="s-arch absolute -inset-9 border border-white/[0.06]" />
            <div className="s-arch relative h-full w-full bg-white/[0.04] shadow-[0_40px_90px_-30px_rgb(0_0_0/0.8)]">
              <AnimatePresence initial={false}>
                <motion.div
                  key={p.slug}
                  className="absolute inset-0"
                  initial={reduce ? { opacity: 0 } : { clipPath: "inset(100% 0% 0% 0%)" }}
                  animate={reduce ? { opacity: 1 } : { clipPath: "inset(0% 0% 0% 0%)" }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1, ease: EASE }}
                >
                  <motion.div className="absolute inset-0" initial={{ scale: reduce ? 1 : 1.15 }} animate={{ scale: 1 }} transition={{ duration: 1.6, ease: EASE }}>
                    <Image src={shot.src} alt={`ORA ${p.use.toLowerCase()} pack, ${p.size} — studio photograph`} fill sizes="520px" className="object-cover" />
                  </motion.div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
        {/* progress rail */}
        <div className="absolute bottom-10 left-8 right-8 mx-auto flex max-w-[1376px] items-center gap-4">
          {products.map((q, k) => (
            <span key={q.slug} className={`s-label transition-colors ${k === i ? "text-white" : ""}`}>{q.size}</span>
          ))}
          <span className="relative h-px flex-1 bg-white/10">
            <motion.span className="absolute inset-y-0 left-0 bg-[rgb(var(--s-pink))]" style={{ width: rail }} />
          </span>
        </div>
      </div>
    </div>
  );
}

function Mobile() {
  return (
    <div className="mx-auto mt-14 grid max-w-[1440px] grid-cols-1 gap-6 px-5 pb-24 sm:grid-cols-2 sm:px-8 lg:hidden">
      {products.map((p, k) => {
        const shot = SHOT[p.slug];
        return (
          <motion.div
            key={p.slug}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ duration: 0.9, ease: EASE, delay: (k % 2) * 0.08 }}
          >
            <Link href={`/products/${p.slug}`} className="group block">
              <div className="relative aspect-[4/5] overflow-hidden rounded-t-[999px] rounded-b-[22px] bg-white/[0.04]">
                <Image src={shot.src} alt={`ORA ${p.use.toLowerCase()} pack, ${p.size} — studio photograph`} fill sizes="(max-width: 640px) 90vw, 45vw" className="object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105" />
                <span className="absolute left-5 top-[22%] font-site-display text-5xl font-semibold leading-none tracking-[-0.05em] text-white/90 [text-shadow:0_2px_20px_rgb(0_0_0/0.4)]">0{k + 1}</span>
              </div>
              <div className="mt-5 flex items-end justify-between gap-4">
                <div>
                  <p className="s-label text-[rgb(var(--s-pink))]">{p.use} · {p.color}</p>
                  <p className="mt-2 font-site-display text-4xl font-semibold uppercase leading-none tracking-[-0.04em]">{p.size}</p>
                  <p className="mt-2 font-site-serif text-xl italic text-white/80">{p.tagline}</p>
                </div>
                <span className="grid size-11 shrink-0 place-items-center rounded-full border border-white/15 transition-colors group-hover:bg-white group-hover:text-[rgb(var(--s-night))]">
                  <ArrowRight className="size-4" strokeWidth={1.5} />
                </span>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
