import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowUpRight } from "lucide-react";
import { Magnetic, Parallax, Rise, SplitText } from "@/components/site/motion";

const vars = (s: string) => Object.fromEntries(s.split(";").map((kv) => kv.split(":"))) as CSSProperties;

function Pack({ src, className, float }: { src: string; className: string; float: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute ${className}`}>
      <div className="s-float" style={vars(float)}>
        <Image src={src} alt="" width={600} height={450} sizes="(max-width: 640px) 130px, 190px" className="h-auto w-full drop-shadow-[0_22px_26px_rgba(40,0,30,0.45)]" />
      </div>
    </div>
  );
}

/**
 * The close of Find ORA: one ORA-pink band. The question in huge type on the left, the way in beside it; on the right
 * the school-event photo in the ORA arch with the three packs floating around it. A giant outlined ORA sits behind.
 */
export function StockistBand() {
  return (
    <section className="relative isolate overflow-hidden bg-[rgb(var(--s-pink))] text-white">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_88%_12%,rgb(139_92_246/0.5),transparent_55%)]" />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-[-0.2em] left-[-0.04em] -z-10 select-none font-site-display text-[clamp(9rem,32vw,28rem)] font-semibold uppercase leading-none tracking-[-0.06em] text-transparent [-webkit-text-stroke:1.5px_rgb(255_255_255/0.28)]"
      >
        ORA
      </span>

      <div className="mx-auto grid max-w-[1440px] grid-cols-1 items-center gap-20 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-12 lg:py-32">
        <div className="min-w-0">
          <div className="flex items-center gap-4">
            <span className="s-label !text-[rgb(var(--s-night))]">[ 03 ]</span>
            <span className="s-label !text-[rgb(var(--s-night)/0.72)]">Stock ORA</span>
            <span aria-hidden className="h-px flex-1 bg-[rgb(var(--s-night)/0.2)]" />
          </div>
          <SplitText
            text="Want ORA on your shelves?"
            accent={["shelves"]}
            className="mt-8 font-site-display text-[clamp(2.5rem,6.6vw,6.4rem)] font-semibold uppercase leading-[0.95] tracking-[-0.035em] [&_.font-site-serif]:normal-case [&_.font-site-serif]:text-[1.1em] [&_.font-site-serif]:text-[rgb(var(--s-night))]"
          />
          <Rise delay={0.1}>
            <p className="mt-7 max-w-md text-[17px] leading-relaxed text-[rgb(var(--s-night)/0.82)] sm:text-lg">
              Pharmacies, shops, schools and NGOs across Tanzania partner with ORA every month. Join the network.
            </p>
            <div className="mt-9">
              <Magnetic>
                <Link
                  href="/request-access"
                  className="group inline-flex h-14 items-center gap-4 rounded-full bg-[rgb(var(--s-night))] pl-7 pr-2 text-[15px] font-semibold text-white shadow-[0_18px_40px_-14px_rgb(40_0_30/0.7)] transition-transform active:scale-[0.97]"
                >
                  Become a stockist
                  <span className="grid size-10 place-items-center rounded-full bg-[rgb(var(--s-pink))] transition-transform duration-300 group-hover:rotate-45">
                    <ArrowUpRight className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                </Link>
              </Magnetic>
            </div>
          </Rise>
        </div>

        <Rise className="mx-auto w-full max-w-[230px] sm:max-w-[300px] lg:mr-[20%] lg:max-w-[340px]">
          <div className="relative">
            <div aria-hidden className="s-arch absolute -inset-3 border border-white/50" />
            <div aria-hidden className="s-arch absolute -inset-7 border border-white/20" />
            <Parallax speed={0.08} className="s-arch aspect-[4/5] w-full bg-[rgb(var(--s-night)/0.25)]">
              <Image
                src="/ora/gallery/g2.jpg"
                alt="A student at an ORA school event beside packs of ORA pads stacked on a table"
                fill
                sizes="(max-width: 640px) 230px, 340px"
                className="object-cover"
                style={{ objectPosition: "40% 50%" }}
              />
            </Parallax>
            <Pack src="/ora/site/pack-night.webp" className="-left-[30%] top-[6%] w-[56%]" float="--dur:7s;--amp:-14px;--r0:-14deg;--r1:-9deg" />
            <Pack src="/ora/site/pack-day.webp" className="-right-[30%] top-[44%] w-[52%]" float="--dur:8.5s;--amp:-20px;--r0:12deg;--r1:7deg;--delay:-2s" />
            <Pack src="/ora/site/pack-liner.webp" className="-bottom-[6%] -left-[14%] w-[38%]" float="--dur:6.5s;--amp:-10px;--r0:-6deg;--r1:-2deg;--delay:-1s" />
          </div>
        </Rise>
      </div>
    </section>
  );
}
