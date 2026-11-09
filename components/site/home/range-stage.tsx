"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Droplet } from "lucide-react";
import { products } from "@/lib/products";
import { SectionLabel, SplitText, EASE } from "@/components/site/motion";

const CUT: Record<string, { src: string; glow: string; name: string }> = {
  "night-360": { src: "/ora/site/pack-night.webp", glow: "123 97 255", name: "Night" },
  "day-290": { src: "/ora/site/pack-day.webp", glow: "56 189 248", name: "Day" },
  "liner-180": { src: "/ora/site/pack-liner.webp", glow: "255 77 189", name: "Liner" },
};

/**
 * The range as a stage. On a computer the section pins while you scroll: each pack slides in big and turns a little,
 * the light behind it changes to the pack's colour, and its size, use and details change beside it. On a phone the
 * three packs stack, each floating on its own colour.
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
  const turn = useTransform(scrollYProgress, [0, 1], [-10, 10]);
  const rail = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  const p = products[i];
  const cut = CUT[p.slug];

  return (
    <div ref={ref} className="relative hidden lg:block" style={{ height: `${products.length * 100}vh` }}>
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        {/* the light behind the pack takes its colour */}
        <motion.div
          aria-hidden
          className="absolute right-[8%] top-1/2 size-[46vw] -translate-y-1/2 rounded-full blur-[110px]"
          animate={{ backgroundColor: `rgb(${cut.glow} / 0.42)` }}
          transition={{ duration: 0.9 }}
        />
        <div className="relative mx-auto grid w-full max-w-[1440px] grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-center gap-10 px-8">
          <div className="relative">
            <div className="flex items-baseline gap-4">
              <span className="font-site-display text-[8rem] font-semibold leading-none tracking-[-0.05em] s-outline">0{i + 1}</span>
              <span className="s-label">/ 0{products.length}</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={p.slug}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -24 }}
                transition={{ duration: 0.55, ease: EASE }}
              >
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
                  Discover the {cut.name.toLowerCase()} pack
                  <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={1.5} />
                </Link>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="relative flex h-[70vh] items-center justify-center">
            <AnimatePresence mode="popLayout">
              <motion.div
                key={p.slug}
                initial={reduce ? false : { opacity: 0, x: 160, rotate: 18, scale: 0.85 }}
                animate={{ opacity: 1, x: 0, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, x: -160, rotate: -14, scale: 0.85 }}
                transition={{ duration: 0.8, ease: EASE }}
                className="absolute w-[min(100%,620px)]"
              >
                <motion.div style={{ rotate: reduce ? 0 : turn }}>
                  <div className="s-float" style={{ ["--amp" as string]: "-20px", ["--dur" as string]: "6s" }}>
                    <Image src={cut.src} alt={`ORA ${p.use.toLowerCase()} pack, ${p.size}`} width={1100} height={800} sizes="620px" className="h-auto w-full drop-shadow-[0_40px_60px_rgba(0,0,0,0.55)]" />
                  </div>
                </motion.div>
              </motion.div>
            </AnimatePresence>
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
        const cut = CUT[p.slug];
        return (
          <motion.div
            key={p.slug}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ duration: 0.9, ease: EASE, delay: (k % 2) * 0.08 }}
          >
            <Link href={`/products/${p.slug}`} className="group relative block overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
              <div aria-hidden className="absolute -right-10 -top-10 size-64 rounded-full blur-[70px]" style={{ background: `rgb(${cut.glow} / 0.45)` }} />
              <div className="relative flex items-start justify-between">
                <span className="font-site-display text-5xl font-semibold leading-none tracking-[-0.05em] s-outline">0{k + 1}</span>
                <span className="s-label text-[rgb(var(--s-pink))]">{p.use}</span>
              </div>
              <div className="relative mx-auto my-6 w-[78%]">
                <div className="s-float" style={{ ["--amp" as string]: "-12px", ["--dur" as string]: `${6 + k}s` }}>
                  <Image src={cut.src} alt={`ORA ${p.use.toLowerCase()} pack, ${p.size}`} width={600} height={450} sizes="70vw" className="h-auto w-full drop-shadow-[0_24px_30px_rgba(0,0,0,0.5)]" />
                </div>
              </div>
              <div className="relative flex items-end justify-between gap-4">
                <div>
                  <p className="font-site-display text-4xl font-semibold uppercase leading-none tracking-[-0.04em]">{p.size}</p>
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
