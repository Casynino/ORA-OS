"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Magnetic, Parallax, Rise, ScrollWords, SplitText, EASE } from "@/components/site/motion";
import { CountUp } from "@/components/ui/count-up";
import { products } from "@/lib/products";
import { ORA_CONTACT } from "@/lib/constants";

/*
 * The home page sections, built on the Reckless site's system (owner, 2026-11-09: "take a very good look at Reckless"):
 * ink ground, bone type, ORA pink as the one accent, mono [ eyebrows ], sharp frames, big photographs, numbered plates,
 * scroll-lit manifesto, hover-swapped index, magazine spread with parallax, a full-bleed campaign, a cursor-led index,
 * an Instagram grid and a closing band with a faint giant word.
 */

const WRAP = "mx-auto w-full max-w-[1600px] px-[clamp(1.25rem,5vw,5rem)]";
const XL = "font-site-display font-semibold uppercase leading-[0.92] tracking-[-0.035em] text-[clamp(2.6rem,8vw,7.4rem)] [&_.font-site-serif]:normal-case [&_.font-site-serif]:text-[1.1em]";
const LG = "font-site-display font-semibold uppercase leading-[0.95] tracking-[-0.03em] text-[clamp(2rem,5.6vw,5rem)] [&_.font-site-serif]:normal-case [&_.font-site-serif]:text-[1.1em]";

function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`s-label block ${className}`}>{children}</span>;
}

/* ── Manifesto: the words light up as they are read ── */
export function Manifesto() {
  return (
    <section id="about" className={`${WRAP} scroll-mt-20 py-28 md:py-40`}>
      <Eyebrow className="mb-10">[ 01 — Why ORA exists ]</Eyebrow>
      <ScrollWords
        text="No girl should miss school, feel unprepared, or lack confidence because of her period. We provide products, education and support that transform lives."
        accent={["school", "confidence", "transform"]}
        className="font-site-display text-[clamp(1.9rem,4.6vw,4.4rem)] font-medium leading-[1.08] tracking-[-0.025em]"
      />
    </section>
  );
}

/* ── The range: an editorial index — point at a size and its studio photograph swaps in ── */
const SHOTS: Record<string, string> = { "night-360": "/ora/site/shot-night.jpg", "day-290": "/ora/site/shot-day.jpg", "liner-180": "/ora/site/shot-liner.jpg" };
export function RangeIndex() {
  const [a, setA] = useState(0);
  const p = products[a];
  return (
    <section id="products" className="relative scroll-mt-20 bg-[rgb(18_18_20)] py-24 md:py-36">
      <div className={WRAP}>
        <Eyebrow className="mb-10">[ 02 — The range · 3 sizes ]</Eyebrow>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
          <div className="s-on-photo relative h-[52vh] overflow-hidden rounded-[2px] bg-[rgb(26_26_29)] lg:h-[72vh]">
            <AnimatePresence mode="popLayout">
              <motion.div
                key={a}
                initial={{ opacity: 0, scale: 1.06, filter: "blur(16px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, filter: "blur(16px)" }}
                transition={{ duration: 0.6, ease: EASE }}
                className="absolute inset-0"
              >
                <Image src={SHOTS[p.slug]} alt={`ORA ${p.use.toLowerCase()} pack, ${p.size} — studio photograph`} fill sizes="(max-width:1024px) 100vw, 45vw" className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[rgb(10_10_11/0.55)] to-transparent" />
              </motion.div>
            </AnimatePresence>
            <span className="absolute bottom-5 left-5 s-label text-white/80">
              {p.size} · {p.padsPerPack} pads · {p.length}
            </span>
          </div>
          <ul className="flex flex-col justify-center">
            {products.map((q, i) => (
              <li key={q.slug}>
                <Link
                  href={`/products/${q.slug}`}
                  data-cursor="View"
                  onMouseEnter={() => setA(i)}
                  onFocus={() => setA(i)}
                  className="group flex items-center justify-between gap-6 border-b border-white/10 py-7 first:border-t md:py-9"
                >
                  <div className="flex items-baseline gap-5">
                    <span className="font-site-mono text-sm text-[rgb(var(--s-pink))]">{String(i + 1).padStart(2, "0")}</span>
                    <span>
                      <span
                        className={`block font-site-display text-[clamp(2.2rem,5.4vw,4.8rem)] font-semibold uppercase leading-none tracking-[-0.035em] transition-all duration-300 ${
                          a === i ? "translate-x-2 text-[rgb(var(--s-ink))]" : "text-transparent [-webkit-text-stroke:1px_rgb(107_107_112)]"
                        }`}
                      >
                        {q.size}
                      </span>
                      <span className={`mt-3 block font-site-serif text-xl italic transition-opacity duration-300 md:text-2xl ${a === i ? "text-white/80 opacity-100" : "text-white/50 opacity-60 lg:opacity-0"}`}>
                        {q.use} — {q.tagline}
                      </span>
                    </span>
                  </div>
                  <span className="font-site-mono text-lg text-[rgb(var(--s-ink))] transition-transform duration-300 group-hover:translate-x-1">→</span>
                </Link>
              </li>
            ))}
            <li className="mt-10">
              <Link href="/products" className="s-btn s-btn--line">See the whole range</Link>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ── Where it happens: an art-directed spread of real school days (numbered plates, parallax, offsets) ── */
const DAYS = [
  { src: "/ora/site/wide-GTM00015.jpg", place: "Jangwani", what: "School day", alt: "Girls laughing together at an ORA school day" },
  { src: "/ora/site/wide-FLP00062.jpg", place: "Zanaki", what: "School visit", alt: "The ORA team cheering beside stacks of pads" },
  { src: "/ora/site/g-juhudi-class.jpg", place: "Juhudi Jeshini", what: "Girls' Day 2026", alt: "Girls listening during an ORA session at International Girls' Day" },
  { src: "/ora/site/g-zanaki-stage.jpg", place: "Zanaki", what: "On stage", alt: "A student speaking on the ORA stage" },
  { src: "/ora/site/wide-GTM00027.jpg", place: "Jangwani", what: "Assembly", alt: "Girls clapping at an ORA assembly" },
];
function Plate({ d, n, ratio, sizes }: { d: (typeof DAYS)[number]; n: string; ratio: string; sizes: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const drift = useTransform(scrollYProgress, [0, 1], ["-7%", "7%"]);
  return (
    <Link ref={ref} href="/impact" data-cursor="Open" className="group block">
      {/* the frame opens like a curtain as it arrives; the photo inside drifts with the scroll and settles from a zoom */}
      <motion.div
        className={`s-on-photo relative w-full overflow-hidden rounded-[2px] bg-[rgb(26_26_29)] ${ratio}`}
        initial={reduce ? false : { clipPath: "inset(100% 0% 0% 0%)" }}
        whileInView={{ clipPath: "inset(0% 0% 0% 0%)" }}
        viewport={{ once: true, margin: "-12% 0px" }}
        transition={{ duration: 1.25, ease: EASE }}
      >
        <motion.div className="absolute inset-x-0 -inset-y-[9%]" style={{ y: reduce ? 0 : drift }}>
          <motion.div className="absolute inset-0" initial={reduce ? false : { scale: 1.18 }} whileInView={{ scale: 1 }} viewport={{ once: true, margin: "-12% 0px" }} transition={{ duration: 1.8, ease: EASE }}>
            <Image src={d.src} alt={d.alt} fill sizes={sizes} className="object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]" />
          </motion.div>
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-t from-[rgb(10_10_11/0.6)] via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <span className="absolute left-4 top-3 font-site-display text-3xl text-white/75 md:text-4xl">{n}</span>
        <span className="absolute bottom-4 left-4 translate-y-2 s-label text-white opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">See the day →</span>
      </motion.div>
      <div className="mt-4 flex items-baseline justify-between gap-4">
        <h3 className="font-site-display text-base uppercase tracking-tight text-[rgb(var(--s-ink))] transition-colors group-hover:text-[rgb(var(--s-pink))] md:text-lg">{d.place}</h3>
        <span className="s-label">{d.what}</span>
      </div>
    </Link>
  );
}
export function WhereItHappens() {
  const [a, b, c, d, e] = DAYS;
  return (
    <section className="relative overflow-hidden py-24 md:py-36">
      <div className={WRAP}>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <Eyebrow className="mb-6">[ 03 — Where it happens ]</Eyebrow>
            <SplitText text="In the schoolyard." accent={["schoolyard"]} className={XL} />
          </div>
          <Rise className="md:pb-3">
            <Link href="/impact" className="s-btn s-btn--line">Our impact</Link>
          </Rise>
        </div>

        <div className="mt-16 grid grid-cols-12 gap-6 md:mt-24">
          <Rise className="col-span-12 lg:col-span-7">
            <Plate d={a} n="01" ratio="aspect-[4/5]" sizes="(max-width:1024px) 100vw, 58vw" />
          </Rise>
          <div className="col-span-12 flex flex-col justify-between gap-10 lg:col-span-5 lg:pt-28">
            <Rise delay={0.1}>
              <p className="max-w-sm text-lg leading-relaxed text-white/70">
                School by school, community by community — pads in real hands, honest talk about periods, and girls who
                walk out of the hall a little taller.
              </p>
            </Rise>
            <Rise delay={0.15}>
              <Plate d={b} n="02" ratio="aspect-square" sizes="(max-width:1024px) 100vw, 40vw" />
            </Rise>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-12 items-start gap-6 md:mt-10">
          <Rise className="col-span-6 lg:col-span-4">
            <Plate d={c} n="03" ratio="aspect-[3/4]" sizes="(max-width:1024px) 50vw, 33vw" />
          </Rise>
          <Rise className="col-span-6 lg:col-span-4 lg:mt-40">
            <Plate d={d} n="04" ratio="aspect-[3/4]" sizes="(max-width:1024px) 50vw, 33vw" />
          </Rise>
          <Rise className="col-span-12 lg:col-span-4 lg:mt-16">
            <Plate d={e} n="05" ratio="aspect-square" sizes="(max-width:1024px) 100vw, 33vw" />
          </Rise>
        </div>
      </div>
    </section>
  );
}

/* ── Campaign: full-bleed photograph, one huge statement ── */
export function CampaignBand() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-12%", "12%"]);
  const reduceY = reduce ? "0%" : "110%";
  return (
    <section ref={ref} className="s-on-photo relative isolate h-[110svh] min-h-[600px] overflow-hidden">
      <motion.div className="absolute inset-x-0 -top-[15%] -z-10 h-[130%]" style={{ y: reduce ? 0 : y }}>
        <Image src="/ora/hero-stage.jpg" alt="An ORA host on stage holding up a pack of ORA pads" fill sizes="100vw" className="object-cover" style={{ objectPosition: "50% 34%" }} />
      </motion.div>
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0a0a0b] via-[#0a0a0b]/50 to-[#0a0a0b]/40" />
      <div className={`${WRAP} flex h-full flex-col justify-end pb-20 md:pb-28`}>
        <Eyebrow className="mb-4 text-white/75">[ Campaign — Feel protected ]</Eyebrow>
        {/* the trigger sits on the visible frame, so the line (hidden below it) rises when the band arrives */}
        <motion.div className="overflow-hidden" initial="hidden" whileInView="show" viewport={{ once: true, margin: "-15% 0px" }}>
          <motion.h2
            className={`max-w-5xl ${XL}`}
            variants={{ hidden: { y: reduceY }, show: { y: "0%", transition: { duration: 1, ease: EASE } } }}
          >
            Feel protected. Feel <span className="font-site-serif text-[1.1em] normal-case italic text-[rgb(var(--s-pink))]">free</span>. With ORA.
          </motion.h2>
        </motion.div>
        <Magnetic className="mt-10 w-fit" strength={0.4}>
          <Link href="/products" data-cursor="Shop" className="s-btn s-btn--pink">Shop the range</Link>
        </Magnetic>
      </div>
    </section>
  );
}

/* ── What ORA stands for, beside two offset photographs ── */
export function BehindOra() {
  return (
    <section className={`${WRAP} py-24 md:py-36`}>
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-20">
        <div>
          <Eyebrow>[ 04 — What we stand for ]</Eyebrow>
          <SplitText text="Pads, education and dignity." accent={["dignity"]} className={`mt-4 max-w-xl ${LG}`} />
          <Rise delay={0.1}>
            <ul className="mt-10 max-w-lg divide-y divide-white/10 border-y border-white/10">
              {[
                ["Premium quality", "High-quality pads designed for comfort and protection."],
                ["Education first", "Empowering girls with knowledge about their bodies and health."],
                ["Community impact", "Working with schools, communities and partners to create change."],
                ["Dignity for all", "Every girl deserves to live her life with dignity and confidence."],
              ].map(([t, b], i) => (
                <li key={t} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2 py-5">
                  <span className="font-site-mono text-sm text-[rgb(var(--s-pink))]">0{i + 1}</span>
                  <span>
                    <span className="block font-site-display text-lg uppercase tracking-tight">{t}</span>
                    <span className="mt-1 block text-[15px] leading-relaxed text-white/60">{b}</span>
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/impact" className="s-btn s-btn--line mt-10">Meet the movement</Link>
          </Rise>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Parallax speed={0.12} className="aspect-[3/4] rounded-[2px] bg-[rgb(26_26_29)]">
            <div className="relative h-full w-full">
              <Image src="/ora/site/g-jangwani-laugh.jpg" alt="Girls laughing at an ORA school day" fill sizes="30vw" className="object-cover" />
            </div>
          </Parallax>
          <Parallax speed={-0.12} className="mt-10 aspect-[3/4] rounded-[2px] bg-[rgb(26_26_29)]">
            <div className="relative h-full w-full">
              <Image src="/ora/site/g-zanaki-joy.jpg" alt="Girls celebrating at an ORA school visit" fill sizes="30vw" className="object-cover" />
            </div>
          </Parallax>
        </div>
      </div>
    </section>
  );
}

/* ── The figures ── */
export function Numbers({ stats }: { stats: { label: string; value: number; note: string }[] }) {
  return (
    <section className="border-y border-white/10 bg-[rgb(18_18_20)]">
      <div className={`${WRAP} grid grid-cols-2 lg:grid-cols-4`}>
        {stats.map((s, i) => (
          <Rise
            key={s.label}
            delay={i * 0.06}
            className={`py-12 md:py-16 ${i % 2 ? "border-l border-white/10 pl-5 md:pl-8" : "pr-5"} ${i === 2 ? "border-t border-white/10 lg:border-l lg:border-t-0 lg:pl-8" : ""} ${i === 3 ? "border-t border-white/10 lg:border-t-0" : ""}`}
          >
            <p className="s-label">{s.label}</p>
            <p className="mt-4 font-site-display text-[clamp(2rem,3.7vw,3.9rem)] font-semibold leading-none tracking-[-0.045em] tabular-nums">
              <CountUp value={s.value} suffix="+" />
            </p>
            <p className="mt-3 max-w-[16rem] text-[14px] leading-relaxed text-white/50">{s.note}</p>
          </Rise>
        ))}
      </div>
    </section>
  );
}

/* ── Get involved: an index; pointing at a row floats its photograph by the cursor ── */
const ROWS = [
  { label: "Our impact", meta: "Stories & live figures", href: "/impact", image: "/ora/site/wide-GTM00027.jpg" },
  { label: "Find ORA", meta: "Stockists across Tanzania", href: "/find-ora", image: "/ora/site/shot-night.jpg" },
  { label: "Education hub", meta: "English & Kiswahili", href: "/education", image: "/ora/site/g-juhudi-class.jpg" },
  { label: "Become an agent", meta: "Schools · NGOs · distributors", href: "/request-access", image: "/ora/site/wide-FLP00062.jpg" },
  { label: "Track your cycle", meta: "Private, on your phone", href: "/tracker", image: "/ora/site/shot-liner.jpg" },
];
export function GetInvolved() {
  const [active, setActive] = useState<number | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 120, damping: 18, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 120, damping: 18, mass: 0.4 });
  const wrap = useRef<HTMLDivElement>(null);
  return (
    <section className={`${WRAP} py-24 md:py-36`}>
      <Eyebrow className="mb-10">[ 05 — Get involved ]</Eyebrow>
      <div
        ref={wrap}
        onMouseMove={(e) => {
          const r = wrap.current?.getBoundingClientRect();
          if (!r) return;
          x.set(e.clientX - r.left);
          y.set(e.clientY - r.top);
        }}
        className="relative"
      >
        {ROWS.map((row, i) => (
          <Link
            key={row.href}
            href={row.href}
            data-cursor="Open"
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className="group flex items-center justify-between gap-6 border-t border-white/10 py-6 last:border-b md:py-9"
          >
            <span
              className={`font-site-display text-[clamp(2rem,5.4vw,4.8rem)] font-semibold uppercase leading-none tracking-[-0.035em] transition-all duration-500 ${
                active === i ? "translate-x-4 text-[rgb(var(--s-pink))]" : "text-[rgb(var(--s-ink))]"
              } ${active !== null && active !== i ? "opacity-30" : "opacity-100"}`}
            >
              {row.label}
            </span>
            <span className="s-label hidden text-right sm:block">{row.meta}</span>
          </Link>
        ))}
        <AnimatePresence>
          {active !== null && (
            <motion.div
              className="pointer-events-none absolute left-0 top-0 z-20 hidden aspect-[3/4] w-64 overflow-hidden rounded-[2px] md:block"
              style={{ x: sx, y: sy, translateX: "-50%", translateY: "-50%" }}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <Image src={ROWS[active].image} alt="" fill sizes="256px" className="object-cover" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

/* ── News as a feed: hover a row and its photo follows the cursor ── */
type Post = { slug: string; title: string; date: string; img: string };
export function Feed({ news }: { news: Post[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 22 });
  const sy = useSpring(y, { stiffness: 200, damping: 22 });
  return (
    <section id="news" className={`${WRAP} scroll-mt-20 py-24 md:py-32`}>
      <div className="mb-10 flex items-end justify-between gap-6">
        <div>
          <Eyebrow>[ 06 — The newsroom ]</Eyebrow>
          <h2 className={`mt-3 ${LG}`}>Latest news</h2>
        </div>
        <Link href="/news" className="s-link pb-2 text-white/80 hover:text-white">All news</Link>
      </div>
      <div
        className="relative"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          x.set(e.clientX - r.left);
          y.set(e.clientY - r.top);
        }}
        onMouseLeave={() => setHover(null)}
      >
        {news.length === 0 ? (
          <p className="border-t border-white/10 pt-6 text-white/60">No posts yet — check back soon.</p>
        ) : (
          <ul className="border-t border-white/10">
            {news.map((n, i) => (
              <li key={n.slug} onMouseEnter={() => setHover(i)}>
                <Link href={`/news/${n.slug}`} data-cursor="Read" className="group grid grid-cols-[64px_minmax(0,1fr)] items-center gap-4 border-b border-white/10 py-6 sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:gap-8 sm:py-8">
                  <span className="relative size-16 overflow-hidden rounded-[2px] sm:hidden">
                    <Image src={n.img} alt="" fill sizes="64px" className="object-cover" />
                  </span>
                  <span className="s-label hidden sm:block">{n.date}</span>
                  <span>
                    <span className="block font-site-display text-xl font-medium uppercase leading-tight tracking-[-0.02em] transition-[color,transform] duration-300 group-hover:translate-x-2 group-hover:text-[rgb(var(--s-pink))] sm:text-3xl">{n.title}</span>
                    <span className="mt-2 block s-label sm:hidden">{n.date}</span>
                  </span>
                  <ArrowUpRight className="hidden size-6 text-white/50 transition-[transform,color] duration-300 group-hover:rotate-45 group-hover:text-white sm:block" strokeWidth={1.5} />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <motion.div aria-hidden className="pointer-events-none absolute left-0 top-0 z-10 hidden h-[220px] w-[300px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[2px] lg:block" style={{ x: sx, y: sy }} animate={{ opacity: hover === null ? 0 : 1, scale: hover === null ? 0.85 : 1 }} transition={{ duration: 0.3 }}>
          {news.map((n, i) => (
            <Image key={n.slug} src={n.img} alt="" fill sizes="300px" className={`object-cover transition-opacity duration-300 ${hover === i ? "opacity-100" : "opacity-0"}`} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ── On the grid: ORA's Instagram wall ── */
const GRID = ["/ora/site/g-campaign-fresh.jpg", "/ora/site/g-zanaki-joy.jpg", "/ora/site/shot-day.jpg", "/ora/site/g-campaign-cloud.jpg", "/ora/site/g-jangwani-laugh.jpg", "/ora/site/shot-liner.jpg"];
export function OnTheGrid() {
  return (
    <section className={`${WRAP} pb-24 md:pb-32`}>
      <div className="mb-10 flex items-end justify-between gap-6">
        <div>
          <Eyebrow>[ 07 — The feed ]</Eyebrow>
          <h2 className={`mt-3 ${LG}`}>On the grid</h2>
        </div>
        <a href={ORA_CONTACT.instagram} target="_blank" rel="noreferrer" className="s-link flex items-center gap-1 pb-2 text-white/80 hover:text-white">
          @orapads.tz <ArrowUpRight className="size-4" strokeWidth={1.5} />
        </a>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {GRID.map((src, i) => (
          <Rise key={src} delay={(i % 6) * 0.05}>
            <a href={ORA_CONTACT.instagram} target="_blank" rel="noreferrer" data-cursor="Open" className="group relative block aspect-square overflow-hidden rounded-[2px] bg-[rgb(26_26_29)]">
              <Image src={src} alt="ORA on Instagram" fill sizes="(max-width:768px) 50vw, 16vw" className="object-cover transition-transform duration-700 group-hover:scale-110" />
              <span className="absolute inset-0 flex items-center justify-center bg-[rgb(10_10_11/0.6)] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <ArrowUpRight className="size-6 text-[rgb(var(--s-pink))]" strokeWidth={1.5} />
              </span>
            </a>
          </Rise>
        ))}
      </div>
    </section>
  );
}

/* ── Closing: the promise over a faint giant ORA ── */
export function Closing() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);
  return (
    // every girl: a schoolyard of girls at an ORA school day behind the closing line, drifting with the scroll and easing
    // back from a slow zoom as it comes into view (owner, 2026-11-09: "this place needs a picture behind, not just words")
    <section ref={ref} className="s-on-photo relative isolate overflow-hidden bg-[rgb(10_10_11)] py-32 md:py-48">
      <motion.div aria-hidden className="absolute inset-x-0 -inset-y-[12%] -z-10" style={{ y: reduce ? 0 : y }}>
        <motion.div
          className="absolute inset-0"
          initial={reduce ? false : { scale: 1.16 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true, margin: "-10% 0px" }}
          transition={{ duration: 2.4, ease: EASE }}
        >
          <Image src="/ora/site/wide-GTM00145.jpg" alt="" fill sizes="100vw" className="object-cover object-[50%_45%]" />
        </motion.div>
      </motion.div>
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_75%_65%_at_50%_50%,rgb(10_10_11/0.84)_0%,rgb(10_10_11/0.62)_62%,rgb(10_10_11/0.74)_100%)]" />
      <div className={`${WRAP} relative text-center`}>
        <Eyebrow className="text-white/80">[ Join the movement ]</Eyebrow>
        <SplitText text="Put a pad in every girl's hand." accent={["hand"]} className={`mx-auto mt-6 max-w-5xl ${LG}`} />
        <p className="mx-auto mt-6 max-w-md text-white/80">Bring ORA to your school or community — agents, distributors, NGOs and schools all welcome.</p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Magnetic strength={0.4}>
            <Link href="/impact" data-cursor="Join" className="s-btn s-btn--pink">Join the movement</Link>
          </Magnetic>
          <Link href="/contact" className="s-btn s-btn--line">Talk to the team</Link>
        </div>
      </div>
    </section>
  );
}
