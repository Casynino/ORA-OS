import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  Check,
  ArrowLeft,
  ArrowRight,
  Wind,
  Feather,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { products, getProduct } from "@/lib/products";
import { ProductGallery } from "@/components/public/product-gallery";
import { SectionHead, btnGhost, btnPrimary } from "@/components/site/page-hero";
import { Atmosphere, Magnetic, Rise, SectionLabel, SplitText } from "@/components/site/motion";
import { CountUp } from "@/components/ui/count-up";
import { ArrowDisc, CtaBand, Drops, packFor } from "@/components/site/pages/products-contact-tracker/shared";
import { ProductStage } from "@/components/site/pages/products-contact-tracker/stages";

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = getProduct(slug);
  if (!p) return { title: "Product not found" };
  return { title: `${p.name} · ${p.size}`, description: p.description };
}

/*
 * One ORA pack as a chapter of the cinematic site (2026-11-09). The pack turns in over its own size in outline and
 * keeps turning as you scroll, on the light of its colour; then the photos up close beside the story and the features,
 * the figures big, why you'll love ORA, the rest of the range floating on their colours, and a closing band.
 * Same product data, links and calls to action as before.
 */
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  const others = products.filter((p) => p.slug !== product.slug);
  const index = products.findIndex((p) => p.slug === product.slug);
  const pack = packFor(product);
  const sizeNumber = Number.parseInt(product.size, 10);

  // The six details: the three figures shown big, the rest as a list.
  const figures = [
    {
      label: "Size",
      value: Number.isFinite(sizeNumber) ? <CountUp value={sizeNumber} /> : product.size,
      unit: Number.isFinite(sizeNumber) ? "mm" : "",
      note: product.length,
    },
    { label: "Pads per pack", value: <CountUp value={product.padsPerPack} duration={1.2} />, unit: product.padsPerPack === 1 ? "pad" : "pads", note: "In every pack" },
    {
      label: "Absorbency",
      value: product.absorbency,
      unit: "of 5",
      note: <Drops n={product.absorbency} color={product.colorHex} />,
    },
  ];
  const specs = [
    { label: "Best for", value: product.bestFor },
    { label: "Top sheet", value: product.topSheet },
    { label: "Use", value: product.use },
  ];

  const whyOra = [
    { icon: Wind, title: "100% air-breathable", body: "Keeps you cool, dry and fresh." },
    { icon: Feather, title: "Soft & rash-free", body: "Gentle cotton-feel surface." },
    { icon: ShieldCheck, title: "Secure protection", body: "Wings that stay in place." },
    { icon: Clock, title: "Long-lasting freshness", body: "Confidence that lasts all day." },
  ];

  return (
    <>
      {/* Hero: the pack on its stage */}
      <section className="relative isolate overflow-hidden">
        <Atmosphere variant="a" className="-z-10" />
        <div
          aria-hidden
          className="absolute -right-[20%] top-[8%] -z-10 aspect-square w-[80vw] max-w-[1000px] rounded-full blur-[120px]"
          style={{ background: `rgb(${pack.glow} / 0.2)` }}
        />
        <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-x-12 gap-y-6 px-5 pb-16 pt-[calc(var(--sat)+7rem)] sm:px-8 sm:pb-24 sm:pt-[calc(var(--sat)+8.5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-y-10">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1 lg:self-end">
            <Link
              href="/products"
              className="group inline-flex items-center gap-2 s-label transition-colors hover:text-white"
            >
              <ArrowLeft className="size-3.5 transition-transform duration-200 group-hover:-translate-x-1" strokeWidth={1.5} aria-hidden="true" />
              All products
            </Link>
            <SectionLabel index={`0${index + 1}`} label={product.use} aside={`${product.color} · ${product.size}`} className="mt-8" />
            <SplitText
              as="h1"
              immediate
              delay={0.15}
              text={product.name}
              accent={pack.accent ? [pack.accent] : []}
              className="mt-8 font-site-display text-[clamp(2.2rem,5.4vw,5.2rem)] font-semibold uppercase leading-[0.95] tracking-[-0.035em] [&_.font-site-serif]:normal-case [&_.font-site-serif]:text-[1.1em]"
            />
            <p className="ora-rise ora-rise-2 mt-6 font-site-serif text-[clamp(1.5rem,2.6vw,2.2rem)] italic leading-snug text-white/85">
              {product.tagline}
            </p>
          </div>

          <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
            <ProductStage
              slug={product.slug}
              image={product.image}
              size={product.size}
              length={product.length}
              padsPerPack={product.padsPerPack}
              alt={`${product.name}, ${product.size} pack`}
            />
          </div>

          <div className="min-w-0 lg:col-start-1 lg:row-start-2 lg:self-start">
            <div className="ora-rise ora-rise-3 flex max-w-lg items-center gap-4 border-y border-white/10 py-4">
              <span className="s-label">Absorbency</span>
              <Drops n={product.absorbency} color={product.colorHex} />
              <span className="ml-auto s-label tabular-nums">{product.absorbency} / 5</span>
            </div>
            <div className="ora-rise ora-rise-4 mt-8 flex flex-wrap items-center gap-3">
              <Magnetic>
                <Link href="/request-access" className={btnPrimary}>
                  Partner with us
                </Link>
              </Magnetic>
              <Link href="/find-ora" className={btnGhost}>
                Find it near you
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </div>
            <p className="ora-rise ora-rise-4 mt-5 text-[13px] text-white/50">
              Available through ORA&apos;s partner network across Tanzania.
            </p>
          </div>
        </div>
      </section>

      {/* 01 — up close: the photos, the story, the features */}
      <section className="relative py-20 sm:py-28">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
          <SectionLabel index="01" label="Up close" aside={`${product.gallery.length} photos`} />
          <div className="mt-12 grid grid-cols-1 gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Rise className="w-full max-w-xl lg:max-w-none">
              <ProductGallery images={product.gallery} name={product.name} />
            </Rise>
            <div className="min-w-0 lg:pt-2">
              <Rise>
                <p className="font-site-display text-[clamp(1.3rem,2.3vw,2rem)] font-medium leading-[1.3] tracking-[-0.02em] text-white/90">
                  {product.description}
                </p>
              </Rise>
              <ul className="mt-12 border-t border-white/10">
                {product.features.map((f, i) => (
                  <li key={f}>
                    <Rise delay={i * 0.04} y={16}>
                      <div className="group flex items-center gap-5 border-b border-white/10 py-4 sm:py-5">
                        <span className="w-7 shrink-0 s-label text-[rgb(var(--s-pink))]">0{i + 1}</span>
                        <span className="min-w-0 flex-1 text-[16px] text-white/85 transition-transform duration-300 group-hover:translate-x-1.5 sm:text-[17px]">
                          {f}
                        </span>
                        <Check className="size-4 shrink-0 text-[rgb(var(--s-pink))]" strokeWidth={1.75} aria-hidden="true" />
                      </div>
                    </Rise>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 02 — the details: the figures big, the rest on hairlines */}
      <section className="relative isolate overflow-hidden py-20 sm:py-28">
        <Atmosphere variant="b" grid={false} className="opacity-60" />
        <div className="relative mx-auto max-w-[1440px] px-5 sm:px-8">
          <SectionHead
            index="02"
            label={product.shortName}
            title="Product details"
            accent={["details"]}
            note={<span>{product.name} — {product.purpose.toLowerCase()}.</span>}
          />
          <dl className="mt-14 grid grid-cols-1 border-t border-white/10 sm:grid-cols-3">
            {figures.map((f, i) => (
              <Rise
                key={f.label}
                delay={i * 0.08}
                className={`border-white/10 py-8 sm:py-10 ${i > 0 ? "border-t sm:border-l sm:border-t-0 sm:pl-8" : ""} ${i < figures.length - 1 ? "sm:pr-8" : ""}`}
              >
                <dt className="s-label">{f.label}</dt>
                <dd className="mt-4">
                  <span className="font-site-display text-[clamp(3.4rem,7.4vw,6.8rem)] font-semibold leading-none tracking-[-0.045em] tabular-nums">
                    {f.value}
                  </span>
                  {f.unit && <span className="ml-2 font-site-serif text-[clamp(1.4rem,2.4vw,2.2rem)] italic text-white/65">{f.unit}</span>}
                  <span className="mt-4 block text-[15px] text-white/55">{f.note}</span>
                </dd>
              </Rise>
            ))}
          </dl>
          <dl className="border-t border-white/10">
            {specs.map((s) => (
              <div
                key={s.label}
                className="group relative isolate grid grid-cols-1 gap-2 overflow-hidden border-b border-white/10 py-6 sm:grid-cols-[minmax(0,0.35fr)_minmax(0,0.65fr)] sm:items-baseline sm:gap-8 sm:py-7"
              >
                <span aria-hidden className="absolute inset-0 -z-10 origin-left scale-x-0 bg-white/[0.035] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100" />
                <dt className="s-label">{s.label}</dt>
                <dd className="font-site-display text-[clamp(1.25rem,2.4vw,2.1rem)] font-medium leading-tight tracking-[-0.025em] transition-transform duration-500 group-hover:translate-x-2">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>


      {/* 03 — why you'll love ORA */}
      <section className="relative py-20 sm:py-28">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
          <SectionLabel index="03" label="Why you'll love ORA" />
          <div className="mt-12 grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
            {whyOra.map((w, i) => (
              <Rise key={w.title} delay={i * 0.06}>
                <div className="group relative border-t border-white/10 pb-12 pt-8">
                  <span aria-hidden className="absolute left-0 top-[-1px] h-px w-full origin-left scale-x-0 bg-[rgb(var(--s-pink))] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100" />
                  <div className="flex items-start justify-between">
                    <span className="font-site-display text-5xl font-semibold leading-none tracking-[-0.05em] s-outline">0{i + 1}</span>
                    <span className="grid size-12 place-items-center rounded-full border border-white/15 transition-colors duration-300 group-hover:border-[rgb(var(--s-pink))]">
                      <w.icon className="size-5 text-[rgb(var(--s-pink))]" strokeWidth={1.5} aria-hidden="true" />
                    </span>
                  </div>
                  <h3 className="mt-10 font-site-display text-2xl font-semibold uppercase leading-[1] tracking-[-0.03em]">{w.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-white/60">{w.body}</p>
                </div>
              </Rise>
            ))}
          </div>
        </div>
      </section>

      {/* 04 — the rest of the range */}
      <section className="relative pb-24 pt-4 sm:pb-32">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
          <SectionHead index="04" label="The range" title="Explore the range" accent={["range"]} />
          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2">
            {others.map((p, i) => {
              const pk = packFor(p);
              return (
                <Rise key={p.slug} delay={i * 0.08}>
                  <Link
                    href={`/products/${p.slug}`}
                    className="group relative isolate flex h-full min-h-[440px] flex-col justify-between overflow-hidden rounded-[2px] border border-white/10 bg-white/[0.02] p-6 outline-none transition-colors duration-300 hover:border-white/20 focus-visible:ring-2 focus-visible:ring-[rgb(var(--s-pink))] sm:min-h-[520px] sm:p-8"
                  >
                    <div
                      aria-hidden
                      className="absolute -right-20 -top-20 -z-10 size-96 rounded-full blur-[80px] transition-transform duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-125"
                      style={{ background: `rgb(${pk.glow} / 0.4)` }}
                    />
                    <div className="flex items-start justify-between gap-4">
                      <span className="flex items-center gap-2 s-label">
                        <span className="size-2 rounded-full" style={{ background: p.colorHex }} aria-hidden="true" />
                        {p.use}
                      </span>
                      <ArrowDisc />
                    </div>
                    <div className="mx-auto my-8 w-[66%] max-w-[340px]">
                      <div className="s-float" style={{ ["--amp" as string]: "-12px", ["--dur" as string]: `${6 + i}s`, ["--r0" as string]: "-3deg", ["--r1" as string]: "2deg" }}>
                        <Image
                          src={pk.src}
                          alt={p.name}
                          width={pk.w}
                          height={pk.h}
                          sizes="(max-width: 768px) 66vw, 340px"
                          className="h-auto w-full drop-shadow-[0_28px_36px_rgba(0,0,0,0.55)] transition-transform duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-rotate-3 group-hover:scale-105"
                        />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-site-display text-[clamp(1.8rem,3.4vw,2.8rem)] font-semibold uppercase leading-none tracking-[-0.04em] tabular-nums">
                        {p.size} · {p.color}
                      </h3>
                      <p className="mt-3 text-[15px] text-white/60">
                        {p.purpose.charAt(0)}
                        {p.purpose.slice(1).toLowerCase()}
                      </p>
                      <p className="mt-5 s-label text-white transition-colors duration-300 group-hover:text-[rgb(var(--s-pink))]">View details →</p>
                    </div>
                  </Link>
                </Rise>
              );
            })}
          </div>
        </div>
      </section>

      <CtaBand
        label="Join us"
        title="Help put ORA in every girl's hand"
        accent={["hand"]}
        body="Join our partner network and bring ORA to your school or community."
        img="/ora/site/wide-GTM00117.jpg"
      >
        <Magnetic>
          <Link href="/impact" className={btnPrimary}>
            See our impact
          </Link>
        </Magnetic>
        <Link href="/request-access" className={btnGhost}>
          Join us
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={1.5} aria-hidden="true" />
        </Link>
      </CtaBand>
    </>
  );
}
