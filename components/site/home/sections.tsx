"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Atmosphere, Magnetic, Parallax, Rise, ScrollWords, SectionLabel, SplitText, EASE } from "@/components/site/motion";
import { CountUp } from "@/components/ui/count-up";

const H2 = "font-site-display font-semibold uppercase leading-[0.95] tracking-[-0.03em] [&_.font-site-serif]:normal-case [&_.font-site-serif]:text-[1.1em]";

/* ── 01 Manifesto: the words light up as they are read; a photo in the arch drifts beside them ── */
export function Manifesto() {
  return (
    <section id="about" className="relative isolate scroll-mt-16 overflow-hidden py-24 sm:py-36">
      <Atmosphere variant="c" grid={false} className="opacity-70" />
      <div className="relative mx-auto max-w-[1440px] px-5 sm:px-8">
        <SectionLabel index="01" label="Why ORA exists" aside="For every girl" />
        <div className="mt-12 grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)] lg:gap-20">
          <ScrollWords
            text="No girl should miss school, feel unprepared, or lack confidence because of her period. We provide products, education and support that transform lives."
            accent={["school", "confidence", "transform"]}
            className="font-site-display text-[clamp(1.8rem,3.9vw,3.6rem)] font-medium leading-[1.12] tracking-[-0.02em]"
          />
          <Rise className="lg:pt-6">
            <Parallax speed={0.1} className="s-arch aspect-[4/5] w-full max-w-[380px]">
              <Image src="/ora/lifestyle-1.jpg" alt="A girl holding a pack of ORA pads" fill sizes="(max-width: 1024px) 80vw, 380px" className="object-cover" />
            </Parallax>
            <p className="mt-5 max-w-[380px] text-[15px] leading-relaxed text-white/60">
              Pads, education and dignity — delivered where they&apos;re needed, community by community, school by school.
            </p>
            <Link href="/impact" className="group mt-5 inline-flex items-center gap-2 text-[15px] font-medium text-white">
              Meet the movement
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={1.5} />
            </Link>
          </Rise>
        </div>
      </div>
    </section>
  );
}

/* ── 03 Values as an index: outlined words fill as you point at them, the photo changes beside them ── */
const VALUES = [
  { title: "Premium quality", body: "High-quality pads designed for comfort and protection.", img: "/ora/site/wide-GTM00063.jpg" },
  { title: "Education first", body: "Empowering girls with knowledge about their bodies and health.", img: "/ora/site/wide-GTM00015.jpg" },
  { title: "Community impact", body: "Working with schools, communities and partners to create change.", img: "/ora/site/wide-GTM00117.jpg" },
  { title: "Dignity for all", body: "Every girl deserves to live her life with dignity and confidence.", img: "/ora/site/wide-GTM00027.jpg" },
];
export function ValuesIndex() {
  const [a, setA] = useState(0);
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
        <SectionLabel index="03" label="What we stand for" />
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <div className="relative hidden h-[62vh] overflow-hidden rounded-[28px] lg:block">
            <AnimatePresence mode="popLayout">
              <motion.div
                key={a}
                initial={{ opacity: 0, scale: 1.08, filter: "blur(14px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, filter: "blur(14px)" }}
                transition={{ duration: 0.7, ease: EASE }}
                className="absolute inset-0"
              >
                <Image src={VALUES[a].img} alt="" fill sizes="40vw" className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[rgb(11_6_18/0.75)] to-transparent" />
              </motion.div>
            </AnimatePresence>
            <span className="absolute bottom-6 left-6 s-label text-white/80">0{a + 1} — {VALUES[a].title}</span>
          </div>
          <ul className="flex flex-col justify-center">
            {VALUES.map((v, i) => (
              <li key={v.title} onMouseEnter={() => setA(i)} onFocus={() => setA(i)} tabIndex={0} className="group border-b border-white/10 py-6 outline-none first:border-t sm:py-8">
                <div className="flex items-baseline gap-5">
                  <span className="s-label text-[rgb(var(--s-pink))]">0{i + 1}</span>
                  <span
                    className={`font-site-display text-[clamp(1.9rem,4.6vw,4.4rem)] font-semibold uppercase leading-none tracking-[-0.03em] transition-[color,transform,-webkit-text-stroke-color] duration-300 ${
                      a === i ? "translate-x-2 text-white" : "text-white lg:text-transparent lg:[-webkit-text-stroke:1px_rgb(247_239_246/0.35)]"
                    }`}
                  >
                    {v.title}
                  </span>
                </div>
                <p className={`mt-3 max-w-md pl-10 text-[15px] leading-relaxed text-white/60 transition-opacity duration-300 lg:pl-12 ${a === i ? "lg:opacity-100" : "lg:opacity-0"}`}>{v.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ── The campaign line over a real ORA stage, the photo drifting ── */
export function CampaignBand() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1.18, 1]);
  return (
    <section ref={ref} className="relative isolate flex min-h-[90svh] items-end overflow-hidden">
      <motion.div className="absolute inset-0 -z-10" style={{ scale: reduce ? 1 : scale }}>
        <Image src="/ora/site/wide-GTM00063.jpg" alt="An ORA host on stage holding up a pack of ORA pads" fill sizes="100vw" className="object-cover object-[60%_30%]" />
      </motion.div>
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-[rgb(11_6_18)] via-[rgb(11_6_18/0.55)] to-[rgb(11_6_18/0.25)]" />
      <div className="mx-auto w-full max-w-[1440px] px-5 pb-16 sm:px-8 sm:pb-24">
        <p className="s-label text-white/75">[ Campaign ] — Feel protected</p>
        <SplitText
          text="Feel protected. Feel free. With ORA."
          accent={["free"]}
          className={`mt-6 max-w-5xl text-[clamp(2.6rem,7vw,7rem)] ${H2}`}
        />
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Magnetic>
            <Link href="/products" className="inline-flex h-14 items-center gap-2 rounded-full bg-white px-7 text-[15px] font-semibold text-[rgb(var(--s-night))] transition-transform active:scale-[0.97]">
              Shop the range
            </Link>
          </Magnetic>
          <Link href="/find-ora" className="group inline-flex h-14 items-center gap-2 rounded-full border border-white/25 px-6 text-[15px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10">
            Find a stockist <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" strokeWidth={1.5} />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── 04 The figures, big ── */
export function Numbers({ stats }: { stats: { label: string; value: number; note: string }[] }) {
  return (
    <section className="relative isolate overflow-hidden py-24 sm:py-32">
      <Atmosphere variant="b" />
      <div className="relative mx-auto max-w-[1440px] px-5 sm:px-8">
        <SectionLabel index="04" label="Impact, live" aside="Updated with every activity" />
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-2">
          {stats.map((s, i) => (
            <Rise key={s.label} delay={(i % 2) * 0.08} className={`border-white/10 py-8 sm:py-10 ${i > 0 ? "border-t" : ""} ${i === 1 ? "sm:border-t-0" : ""} ${i % 2 ? "sm:border-l sm:pl-10" : "sm:pr-10"}`}>
              <p className="s-label">{s.label}</p>
              <p className="mt-4 font-site-display text-[clamp(3.4rem,8vw,7.5rem)] font-semibold leading-none tracking-[-0.045em] tabular-nums">
                <CountUp value={s.value} suffix="+" />
              </p>
              <p className="mt-4 max-w-sm text-[15px] text-white/55">{s.note}</p>
            </Rise>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── 05 From the studio to the schoolyard: a curated editorial mosaic (owner, 2026-11-09: the two rows of arches
   looked like one event repeated — show the campaign, the studio and different school days, displayed beautifully).
   Each photo opens with a curtain as it comes into view and settles from a slow zoom; hover lifts the caption. ── */
const MOSAIC: { src: string; alt: string; tag: string; place: string; cls: string; sizes: string }[] = [
  { src: "/ora/site/g-campaign-fresh.jpg", alt: "ORA campaign: a model holding ORA pads — stay fresh, stay confident", tag: "Campaign", place: "Stay fresh, stay confident", cls: "col-span-2 row-span-4 lg:col-span-5 lg:row-span-6", sizes: "(max-width:1024px) 100vw, 42vw" },
  { src: "/ora/site/wide-GTM00015.jpg", alt: "Girls laughing together at an ORA school day", tag: "School day", place: "Jangwani", cls: "col-span-2 row-span-2 lg:col-span-7 lg:row-span-3", sizes: "(max-width:1024px) 100vw, 58vw" },
  { src: "/ora/site/g-juhudi-table.jpg", alt: "ORA pads stacked on the table at International Girls' Day", tag: "Girls' Day 2026", place: "Juhudi Jeshini", cls: "col-span-1 row-span-2 lg:col-span-4 lg:row-span-3", sizes: "(max-width:1024px) 50vw, 33vw" },
  { src: "/ora/site/shot-day.jpg", alt: "ORA day pads, 290 mm, studio photograph", tag: "Studio", place: "290 mm · day", cls: "col-span-1 row-span-2 lg:col-span-3 lg:row-span-3", sizes: "(max-width:1024px) 50vw, 25vw" },
  { src: "/ora/site/wide-FLP00062.jpg", alt: "The ORA team cheering beside stacks of pads", tag: "School visit", place: "Zanaki", cls: "col-span-2 row-span-2 lg:col-span-7 lg:row-span-4", sizes: "(max-width:1024px) 100vw, 58vw" },
  { src: "/ora/site/g-campaign-cloud.jpg", alt: "ORA campaign: two friends holding ORA packs — soft as a cloud", tag: "Campaign", place: "Soft as a cloud", cls: "col-span-1 row-span-3 lg:col-span-5 lg:row-span-6", sizes: "(max-width:1024px) 50vw, 42vw" },
  { src: "/ora/site/g-zanaki-stage.jpg", alt: "A student speaking on the ORA stage", tag: "On stage", place: "Zanaki", cls: "col-span-1 row-span-3 lg:col-span-4 lg:row-span-4", sizes: "(max-width:1024px) 50vw, 33vw" },
  { src: "/ora/site/shot-night.jpg", alt: "ORA night pads, 360 mm, studio photograph", tag: "Studio", place: "360 mm · night", cls: "col-span-1 row-span-2 lg:col-span-3 lg:row-span-4", sizes: "(max-width:1024px) 50vw, 25vw" },
  { src: "/ora/site/g-juhudi-class.jpg", alt: "Girls listening during an ORA education session", tag: "Education", place: "Juhudi Jeshini", cls: "col-span-1 row-span-2 lg:col-span-5 lg:row-span-3", sizes: "(max-width:1024px) 50vw, 42vw" },
  { src: "/ora/site/g-campaign-mood.jpg", alt: "ORA campaign: for every mood, for every moment", tag: "Campaign", place: "For every mood", cls: "col-span-2 row-span-3 lg:col-span-4 lg:row-span-3", sizes: "(max-width:1024px) 100vw, 33vw" },
];
function MosaicTile({ m, i }: { m: (typeof MOSAIC)[number]; i: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.figure
      className={`group relative isolate overflow-hidden rounded-[22px] bg-white/[0.04] ${m.cls}`}
      initial={reduce ? false : { clipPath: "inset(100% 0% 0% 0% round 22px)" }}
      whileInView={{ clipPath: "inset(0% 0% 0% 0% round 22px)" }}
      viewport={{ once: true, margin: "-12% 0px" }}
      transition={{ duration: 1.25, ease: EASE, delay: (i % 3) * 0.08 }}
    >
      <motion.div
        className="absolute inset-0"
        initial={reduce ? false : { scale: 1.22 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true, margin: "-12% 0px" }}
        transition={{ duration: 1.8, ease: EASE, delay: (i % 3) * 0.08 }}
      >
        <Image src={m.src} alt={m.alt} fill sizes={m.sizes} className="object-cover transition-transform duration-[1.4s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]" />
      </motion.div>
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[rgb(11_6_18/0.7)] via-transparent to-transparent opacity-80 transition-opacity duration-500 group-hover:opacity-100" />
      <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-5">
        <span className="translate-y-1 transition-transform duration-500 group-hover:translate-y-0">
          <span className="block s-label text-[rgb(var(--s-pink))]">{m.tag}</span>
          <span className="mt-1.5 block text-[13px] font-medium text-white sm:text-[15px]">{m.place}</span>
        </span>
        <span className="s-label text-white/60">{String(i + 1).padStart(2, "0")}</span>
      </figcaption>
    </motion.figure>
  );
}
export function RealLife() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
        <SectionLabel index="05" label="ORA in real life" aside="Campaign · studio · school days" />
        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-end">
          <SplitText text="From the studio to the schoolyard" accent={["schoolyard"]} className={`text-[clamp(2.2rem,5.2vw,5rem)] ${H2}`} />
          <p className="max-w-md text-[17px] leading-relaxed text-white/65">
            The faces of the campaign, the packs in the studio, and the school days where it all happens — Zanaki, Jangwani,
            Juhudi Jeshini and more across Tanzania.
          </p>
        </div>
        <div className="mt-14 grid auto-rows-[92px] grid-flow-dense grid-cols-2 gap-3 sm:auto-rows-[120px] sm:gap-4 lg:grid-cols-12 lg:auto-rows-[96px] lg:gap-5">
          {MOSAIC.map((m, i) => (
            <MosaicTile key={m.src} m={m} i={i} />
          ))}
        </div>
        <div className="mt-10 flex justify-end">
          <Link href="/impact" className="group inline-flex items-center gap-2 text-[15px] font-medium text-white">
            See every moment
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={1.5} />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── 06 Ways in: three tall panels ── */
const WAYS = [
  { n: "01", title: "Make an impact", body: "Every school visit, every education session, every pad delivered — see the change we create together.", href: "/impact", cta: "See our impact", img: "/ora/site/wide-GTM00027.jpg" },
  { n: "02", title: "Join the movement", body: "Bring ORA to your school or community — agents, distributors, NGOs and schools all welcome.", href: "/request-access", cta: "Become an agent", img: "/ora/site/wide-GTM00117.jpg" },
  { n: "03", title: "Track your cycle", body: "Track your cycle, get insights and take control of your health.", href: "/tracker", cta: "Open the tracker", img: "/ora/site/wide-FLP00062.jpg" },
];
export function WaysIn() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
        <SectionLabel index="06" label="Get involved" />
        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {WAYS.map((w, i) => (
            <Rise key={w.n} delay={i * 0.08}>
              <Link href={w.href} className="group relative isolate flex h-[480px] flex-col justify-between overflow-hidden rounded-[28px] border border-white/10 p-7 sm:h-[560px]">
                <Image src={w.img} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="-z-10 object-cover opacity-55 transition-[transform,opacity] duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 group-hover:opacity-75" />
                <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-[rgb(11_6_18/0.2)] via-[rgb(11_6_18/0.35)] to-[rgb(11_6_18/0.92)]" />
                <div className="flex items-start justify-between">
                  <span className="font-site-display text-6xl font-semibold leading-none tracking-[-0.05em] s-outline">{w.n}</span>
                  <span className="grid size-12 place-items-center rounded-full border border-white/25 text-white transition-colors duration-300 group-hover:border-[rgb(var(--s-pink))] group-hover:bg-[rgb(var(--s-pink))]">
                    <ArrowUpRight className="size-5 transition-transform duration-300 group-hover:rotate-45" strokeWidth={1.5} />
                  </span>
                </div>
                <div>
                  <h3 className="font-site-display text-3xl font-semibold uppercase leading-none tracking-[-0.03em] sm:text-[2.2rem]">{w.title}</h3>
                  <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-white/70">{w.body}</p>
                  <p className="mt-6 s-label text-white">{w.cta} →</p>
                </div>
              </Link>
            </Rise>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── 07 News as a feed: hover a row and its photo follows the cursor; activities beside it ── */
type Post = { slug: string; title: string; date: string; img: string; category?: string };
export function Feed({ news, activities }: { news: Post[]; activities: string[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 22 });
  const sy = useSpring(y, { stiffness: 200, damping: 22 });
  return (
    <section id="news" className="relative scroll-mt-16 py-24 sm:py-32">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
        <SectionLabel index="07" label="The feed" aside={<Link href="/news" className="hover:text-white">All news →</Link>} />
        <SplitText text="Latest from the field" accent={["field"]} className={`mt-10 text-[clamp(2.2rem,5.2vw,5rem)] ${H2}`} />
        <div
          className="relative mt-12"
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
                  <Link href={`/news/${n.slug}`} className="group grid grid-cols-[64px_minmax(0,1fr)] items-center gap-4 border-b border-white/10 py-6 sm:grid-cols-[140px_minmax(0,1fr)_auto] sm:gap-8 sm:py-8">
                    <span className="relative size-16 overflow-hidden rounded-xl sm:hidden">
                      <Image src={n.img} alt="" fill sizes="64px" className="object-cover" />
                    </span>
                    <span className="s-label hidden sm:block">{n.date}</span>
                    <span>
                      <span className="block font-site-display text-xl font-medium leading-tight tracking-[-0.02em] transition-[color,transform] duration-300 group-hover:translate-x-2 group-hover:text-[rgb(var(--s-pink))] sm:text-3xl">{n.title}</span>
                      <span className="mt-2 block s-label sm:hidden">{n.date}</span>
                    </span>
                    <ArrowUpRight className="hidden size-6 text-white/50 transition-[transform,color] duration-300 group-hover:rotate-45 group-hover:text-white sm:block" strokeWidth={1.5} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <motion.div aria-hidden className="pointer-events-none absolute left-0 top-0 z-10 hidden h-[220px] w-[300px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl lg:block" style={{ x: sx, y: sy }} animate={{ opacity: hover === null ? 0 : 1, scale: hover === null ? 0.85 : 1 }} transition={{ duration: 0.3 }}>
            {news.map((n, i) => (
              <Image key={n.slug} src={n.img} alt="" fill sizes="300px" className={`object-cover transition-opacity duration-300 ${hover === i ? "opacity-100" : "opacity-0"}`} />
            ))}
          </motion.div>
        </div>

        <div id="activities" className="mt-20 scroll-mt-20">
          <div className="flex items-end justify-between gap-6">
            <p className="s-label">Recent activities</p>
            <Link href="/impact" className="s-label hover:text-white">All activities →</Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {activities.map((a, i) => (
              <Rise key={a} delay={i * 0.06}>
                <div className="group relative aspect-[3/4] overflow-hidden rounded-[22px] bg-white/5">
                  <Image src={a} alt="ORA activity" fill sizes="(max-width:1024px) 50vw, 25vw" className="object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105" />
                </div>
              </Rise>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Closing: the promise, huge, over a crowd of girls ── */
export function Closing() {
  return (
    <section className="relative isolate overflow-hidden">
      <Parallax speed={0.12} className="absolute inset-0 -z-10">
        <Image src="/ora/site/wide-GTM00145.jpg" alt="" fill sizes="100vw" className="object-cover" />
      </Parallax>
      <div aria-hidden className="absolute inset-0 -z-10 bg-[rgb(11_6_18/0.72)]" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_60%,rgb(255_63_168/0.28),transparent_60%)]" />
      <div className="mx-auto flex min-h-[90svh] max-w-[1440px] flex-col items-center justify-center px-5 py-28 text-center sm:px-8">
        <p className="s-label text-white/75">[ The promise ]</p>
        <SplitText text="Put a pad in every girl's hand" accent={["hand"]} className={`mt-8 max-w-5xl text-[clamp(2.6rem,7.4vw,7.6rem)] ${H2}`} />
        <div className="mt-12 flex flex-wrap justify-center gap-3">
          <Magnetic>
            <Link href="/impact" className="inline-flex h-14 items-center rounded-full bg-[rgb(var(--s-pink))] px-8 text-[15px] font-semibold text-white shadow-[0_12px_40px_-10px_rgb(255_63_168/0.8)] transition-transform active:scale-[0.97]">
              Join the movement
            </Link>
          </Magnetic>
          <Link href="/contact" className="inline-flex h-14 items-center rounded-full border border-white/25 px-7 text-[15px] font-medium text-white transition-colors hover:bg-white/10">
            Talk to the team
          </Link>
        </div>
      </div>
    </section>
  );
}
