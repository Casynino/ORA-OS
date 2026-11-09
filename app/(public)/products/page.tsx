import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowDown, ArrowRight } from "lucide-react";
import { products } from "@/lib/products";
import { PageHero, SectionHead, btnGhost, btnPrimary } from "@/components/site/page-hero";
import { Atmosphere, Magnetic, Parallax, Rise } from "@/components/site/motion";
import { ArrowDisc, CtaBand, Drops, packFor } from "@/components/site/pages/products-contact-tracker/shared";
import { FitIndex, PackLineup } from "@/components/site/pages/products-contact-tracker/stages";

export const metadata: Metadata = {
  title: "Products",
  description:
    "Meet the ORA range — Night, Day and Daily Liners. 100% air-breathable, long-lasting freshness.",
};

/*
 * The ORA range as a chapter of the cinematic site (2026-11-09): the three packs float at different depths over their
 * sizes sliding past, a band of what every pad is, then one chapter per pack — the real pack photo with the pack
 * floating over it on its own colour, the size huge, the details on hairlines — then "find your fit", where the needs
 * fill as you point at them and the pack beside them changes. Same products and links as before.
 */
export default function ProductsPage() {
  return (
    <>
      <PageHero
        label="The ORA range"
        title="Three sizes, total confidence"
        accent={["confidence"]}
        aside="3 sizes · 100% air-breathable"
        intro="Designed for comfort, protection and everyday confidence — 100% air-breathable, long-lasting freshness."
        actions={
          <>
            <a href="#range" className={btnPrimary}>
              Meet the three packs
              <ArrowDown className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </a>
            <Link href="/find-ora" className={btnGhost}>
              Find ORA near you
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </>
        }
        image="/ora/campaign/protected-trio.jpg"
        imageAlt="A young woman in an ORA polo holding the three ORA packs"
      />

      <PackLineup />


      {/* 01 — one chapter per pack */}
      <section id="range" className="relative isolate scroll-mt-20 overflow-hidden pb-10 pt-24 sm:pb-12 sm:pt-32">
        <Atmosphere variant="b" grid={false} className="opacity-60" />
        <div className="relative mx-auto max-w-[1440px] px-5 sm:px-8">
          <SectionHead
            index="01"
            label="The range"
            title="Protection that fits your flow"
            accent={["flow"]}
            note="Night, Day and Daily Liners — three sizes for every day of the cycle, each in its own colour."
          />

          <div className="mt-16 sm:mt-20">
            {products.map((p, i) => {
              const pack = packFor(p);
              const flip = i % 2 === 1;
              return (
                <article
                  key={p.slug}
                  className="grid grid-cols-1 items-center gap-x-16 gap-y-12 border-t border-white/10 py-16 last:pb-8 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:py-24 lg:last:pb-12"
                >
                  {/* the pack photo, with the pack itself floating over it on its colour */}
                  <Rise className={flip ? "lg:order-2" : undefined}>
                    <Link href={`/products/${p.slug}`} tabIndex={-1} aria-hidden="true" className="group relative block">
                      <div className={`relative w-[78%] ${flip ? "ml-auto" : ""}`}>
                        <Parallax speed={0.08} className="aspect-[4/5] w-full rounded-[2px] border border-white/10 bg-white/5">
                          <Image
                            src={p.image}
                            alt={p.name}
                            fill
                            sizes="(max-width: 1024px) 78vw, 36vw"
                            className="object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
                          />
                        </Parallax>
                      </div>
                      <div className={`absolute bottom-[-6%] w-[58%] ${flip ? "left-0" : "right-0"}`}>
                        <div aria-hidden className="absolute inset-[10%] -z-10 rounded-full blur-[60px]" style={{ background: `rgb(${pack.glow} / 0.55)` }} />
                        <div
                          className="s-float"
                          style={{
                            ["--dur" as string]: `${6 + i}s`,
                            ["--r0" as string]: flip ? "6deg" : "-6deg",
                            ["--r1" as string]: flip ? "2deg" : "-2deg",
                            ["--amp" as string]: "-16px",
                          }}
                        >
                          <Image
                            src={pack.src}
                            alt=""
                            width={pack.w}
                            height={pack.h}
                            sizes="(max-width: 1024px) 58vw, 30vw"
                            className="h-auto w-full drop-shadow-[0_34px_44px_rgba(0,0,0,0.6)] transition-transform duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-rotate-3 group-hover:scale-105"
                          />
                        </div>
                      </div>
                    </Link>
                  </Rise>

                  {/* the words */}
                  <Rise delay={0.08} className={flip ? "lg:order-1" : undefined}>
                    <div className="flex items-start justify-between gap-6">
                      <span className="font-site-display text-[clamp(4.5rem,10vw,9rem)] font-semibold leading-[0.8] tracking-[-0.05em] s-outline">
                        0{i + 1}
                      </span>
                      <span className="flex items-center gap-2 pt-2 s-label">
                        <span className="size-2 rounded-full" style={{ background: p.colorHex }} aria-hidden="true" />
                        {p.color}
                      </span>
                    </div>
                    <p className="mt-8 s-label text-[rgb(var(--s-pink))]">{p.use}</p>
                    <h2 className="mt-4font-site-display text-[clamp(3.4rem,8vw,7.2rem)] font-semibold uppercase leading-[0.88] tracking-[-0.045em] tabular-nums">
                      {p.size.replace("mm", "")}
                      <span className="font-site-serif text-[0.5em] normal-case italic tracking-normal text-white/70">mm</span>
                    </h2>
                    <p className="mt-4 font-site-serif text-[clamp(1.5rem,2.4vw,2.1rem)] italic leading-snug text-white/85">{p.tagline}</p>
                    <p className="mt-3 text-[15px] leading-relaxed text-white/60">
                      {p.use} · {p.purpose.toLowerCase()}
                    </p>
                    <dl className="mt-8 grid max-w-lg grid-cols-3 border-y border-white/10 text-sm">
                      <div className="py-4 pr-3">
                        <dt className="s-label">Length</dt>
                        <dd className="mt-2 text-white/90">{p.length}</dd>
                      </div>
                      <div className="border-l border-white/10 px-3 py-4 sm:px-4">
                        <dt className="s-label">Per pack</dt>
                        <dd className="mt-2 text-white/90">{p.padsPerPack}</dd>
                      </div>
                      <div className="border-l border-white/10 py-4 pl-3 sm:pl-4">
                        <dt className="s-label">Absorb.</dt>
                        <dd className="mt-2">
                          <Drops n={p.absorbency} color={p.colorHex} className="[&_svg]:size-3.5 sm:[&_svg]:size-4" />
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-4 text-[15px] text-white/55">Best for: {p.bestFor.toLowerCase()}</p>
                    <Link href={`/products/${p.slug}`} className="group mt-9 inline-flex items-center gap-4 text-[15px] font-medium text-white">
                      <ArrowDisc size="lg" />
                      <span className="transition-transform duration-300 group-hover:translate-x-1">View details</span>
                    </Link>
                  </Rise>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* 02 — pick by need */}
      <section className="relative py-24 sm:py-32">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
          <SectionHead
            index="02"
            label="Find your fit"
            aside="By flow"
            title="Which pack is yours?"
            accent={["yours"]}
            note="From heavy nights to light days — pick the flow, and the pack that matches it."
          />
          <FitIndex />
        </div>
      </section>

      <CtaBand
        label="Find ORA"
        title="Available across Tanzania"
        accent={["tanzania"]}
        body="Available through ORA's partner network across Tanzania — find it near you, or bring ORA to your school or community."
        img="/ora/site/wide-GTM00063.jpg"
        position="60% 30%"
      >
        <Magnetic>
          <Link href="/find-ora" className={btnPrimary}>
            Find ORA near you
          </Link>
        </Magnetic>
        <Link href="/request-access" className={btnGhost}>
          Partner with us
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={1.5} aria-hidden="true" />
        </Link>
      </CtaBand>
    </>
  );
}
