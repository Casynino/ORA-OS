import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  Droplet,
  Check,
  ArrowLeft,
  ArrowRight,
  Wind,
  Feather,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { products, getProduct } from "@/lib/products";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/ui/reveal";
import { ProductGallery } from "@/components/public/product-gallery";

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
 * One ORA pack (unslop pass, 2026-11-09). The photos carry the pack's colour; the chrome stays quiet — a dot in the
 * pack colour, the drops for absorbency, hairline lists for the details. No colour blobs, glass cards or icon tiles.
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

  const specs = [
    { label: "Size", value: `${product.size} · ${product.length}` },
    { label: "Pads per pack", value: `${product.padsPerPack}` },
    { label: "Absorbency", value: `${product.absorbency} of 5 drops` },
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
      {/* Hero */}
      <section className="container pb-16 pt-8 sm:pb-20 sm:pt-12">
        <Link
          href="/products"
          className="group inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft
            className="size-4 transition-transform duration-150 group-hover:-translate-x-0.5"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          All products
        </Link>

        <div className="mt-8 grid grid-cols-1 gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Reveal className="w-full max-w-xl lg:max-w-none">
            <ProductGallery images={product.gallery} name={product.name} />
          </Reveal>

          <div className="lg:pt-6">
            <p className="ora-rise flex items-center gap-2 text-sm font-medium text-primary">
              <span className="size-2 rounded-full" style={{ background: product.colorHex }} aria-hidden="true" />
              {product.use}
            </p>
            <h1 className="ora-rise ora-rise-1 mt-3 text-balance font-display text-4xl font-semibold leading-[1.05] tracking-[-0.025em] sm:text-5xl">
              {product.name}
            </h1>
            <p className="ora-rise ora-rise-2 mt-4 text-lg text-foreground/80">{product.tagline}</p>

            <div className="ora-rise ora-rise-2 mt-6 flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Absorbency</span>
              <div className="flex gap-1" role="img" aria-label={`${product.absorbency} of 5 drops`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Droplet
                    key={i}
                    className={cn("size-[18px]", i >= product.absorbency && "text-muted-foreground/30")}
                    strokeWidth={1.5}
                    aria-hidden="true"
                    style={
                      i < product.absorbency
                        ? { color: product.colorHex, fill: product.colorHex }
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>

            <p className="ora-rise ora-rise-3 mt-6 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
              {product.description}
            </p>

            <ul className="ora-rise ora-rise-3 mt-8 grid grid-cols-1 gap-x-8 gap-y-3 border-t border-border pt-6 sm:grid-cols-2">
              {product.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[15px]">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.5} aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>

            <div className="ora-rise ora-rise-4 mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
              <Link
                href="/request-access"
                className="inline-flex h-12 items-center rounded-full bg-primary px-6 text-[15px] font-medium text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.97]"
              >
                Partner with us
              </Link>
              <Link
                href="/find-ora"
                className="group inline-flex h-12 items-center gap-2 text-[15px] font-medium text-primary"
              >
                Find it near you
                <ArrowRight
                  className="size-4 transition-transform duration-150 group-hover:translate-x-0.5"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </Link>
            </div>
            <p className="ora-rise ora-rise-4 mt-4 text-[13px] text-muted-foreground">
              Available through ORA&apos;s partner network across Tanzania.
            </p>
          </div>
        </div>
      </section>

      {/* Product details */}
      <section className="container pb-16 sm:pb-20">
        <div className="grid grid-cols-1 gap-x-16 gap-y-8 border-t border-border pt-16 sm:pt-20 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Reveal>
            <p className="text-sm font-medium text-primary">{product.shortName}</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
              Product details
            </h2>
          </Reveal>
          <Reveal delay={0.06}>
            <dl className="divide-y divide-border border-y border-border">
              {specs.map((s) => (
                <div key={s.label} className="flex items-baseline justify-between gap-6 py-4">
                  <dt className="shrink-0 text-[15px] text-muted-foreground">{s.label}</dt>
                  <dd className="text-right text-[15px] font-medium tabular-nums">{s.value}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </section>

      {/* Why you'll love ORA */}
      <section className="container pb-20 sm:pb-28">
        <div className="grid grid-cols-1 gap-x-10 gap-y-10 border-t border-border pt-10 sm:grid-cols-2 lg:grid-cols-4">
          {whyOra.map((w, i) => (
            <Reveal key={w.title} delay={i * 0.05}>
              <w.icon className="size-5 text-primary" strokeWidth={1.5} aria-hidden="true" />
              <h3 className="mt-5 text-lg font-semibold tracking-[-0.01em]">{w.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{w.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Explore the range */}
      <section className="container pb-20 sm:pb-28">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">Explore the range</h2>
        </Reveal>
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {others.map((p, i) => (
            <Reveal key={p.slug} delay={i * 0.06}>
              <Link
                href={`/products/${p.slug}`}
                className="group flex h-full items-center gap-5 rounded-2xl border border-border bg-card p-4 outline-none transition-colors duration-150 hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring sm:gap-6"
              >
                <div className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-muted sm:size-28">
                  <Image
                    src={p.image}
                    alt={p.name}
                    fill
                    sizes="112px"
                    className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
                  />
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                    <span className="size-2 rounded-full" style={{ background: p.colorHex }} aria-hidden="true" />
                    {p.use}
                  </p>
                  <h3 className="mt-1.5 font-display text-xl font-semibold tabular-nums tracking-[-0.02em]">
                    {p.size} · {p.color}
                  </h3>
                  <p className="mt-0.5 text-[15px] text-muted-foreground">
                    {p.purpose.charAt(0)}
                    {p.purpose.slice(1).toLowerCase()}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-2 text-[15px] font-medium text-primary">
                    View details
                    <ArrowRight
                      className="size-4 transition-transform duration-150 group-hover:translate-x-0.5"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container pb-20 sm:pb-28">
        <Reveal>
          <div className="grid grid-cols-1 gap-8 rounded-2xl bg-[#2a0845] p-8 text-white sm:p-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-16">
            <div>
              <h2 className="text-balance font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
                Help put ORA in every girl&apos;s hand
              </h2>
              <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-white/75">
                Join our partner network and bring ORA to your school or community.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
              <Link
                href="/impact"
                className="inline-flex h-12 items-center rounded-full bg-primary px-6 text-[15px] font-medium text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.97]"
              >
                See our impact
              </Link>
              <Link
                href="/request-access"
                className="group inline-flex h-12 items-center gap-2 text-[15px] text-white/80 transition-colors hover:text-white"
              >
                Join us
                <ArrowRight
                  className="size-4 transition-transform duration-150 group-hover:translate-x-0.5"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
