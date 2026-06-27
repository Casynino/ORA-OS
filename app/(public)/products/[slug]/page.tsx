import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  Moon,
  Sun,
  Sparkles,
  Droplet,
  Check,
  ArrowLeft,
  ArrowRight,
  HeartHandshake,
  Wind,
  Feather,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { products, getProduct } from "@/lib/products";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";
import { ProductGallery } from "@/components/public/product-gallery";

const iconMap = { moon: Moon, sun: Sun, sparkles: Sparkles } as const;

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

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  const Icon = iconMap[product.icon];
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
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-24 left-1/2 size-[40rem] -translate-x-1/2 rounded-full opacity-30 blur-[140px]"
          style={{ background: product.colorHex }}
        />
        <div className="container relative py-10">
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            All products
          </Link>

          <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-14">
            <Reveal>
              <ProductGallery
                images={product.gallery}
                name={product.name}
                accent={product.colorHex}
              />
            </Reveal>

            <Reveal delay={0.1}>
              <span
                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium text-white"
                style={{ background: product.colorHex }}
              >
                <Icon className="size-4" />
                {product.use}
              </span>
              <h1 className="mt-4 font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
                {product.name}
              </h1>
              <p className="mt-2 text-lg font-medium text-primary">
                {product.tagline}
              </p>

              <div className="mt-5 flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground">
                  Absorbency
                </span>
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Droplet
                      key={i}
                      className={cn(
                        "size-5",
                        i >= product.absorbency && "text-muted-foreground/30",
                      )}
                      style={
                        i < product.absorbency
                          ? { color: product.colorHex, fill: product.colorHex }
                          : undefined
                      }
                    />
                  ))}
                </div>
              </div>

              <p className="mt-5 leading-relaxed text-muted-foreground">
                {product.description}
              </p>

              <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {product.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="size-3" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/request-access"
                  className={cn(buttonVariants({ size: "lg" }), "rounded-full")}
                >
                  <HeartHandshake className="size-5" />
                  Partner with us
                </Link>
                <Link
                  href="/donate"
                  className={cn(
                    buttonVariants({ size: "lg", variant: "outline" }),
                    "rounded-full",
                  )}
                >
                  Donate pads
                  <ArrowRight className="size-4" />
                </Link>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Available through ORA&apos;s partner network across Tanzania.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Product details */}
      <section className="container py-12">
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
          <h2 className="font-display text-2xl font-bold">Product details</h2>
          <dl className="mt-6 grid gap-x-10 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {specs.map((s) => (
              <div
                key={s.label}
                className="flex items-center justify-between gap-4 border-b border-border py-3"
              >
                <dt className="text-sm text-muted-foreground">{s.label}</dt>
                <dd className="text-right text-sm font-semibold">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Why you'll love ORA */}
      <section className="container py-8">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {whyOra.map((w) => (
            <Reveal key={w.title}>
              <div className="glass-card glow-hover h-full rounded-2xl p-6 text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-glow">
                  <w.icon className="size-5" />
                </span>
                <h3 className="mt-3 font-semibold">{w.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{w.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Explore the range */}
      <section className="container py-12">
        <h2 className="font-display text-3xl font-bold tracking-tight">
          Explore the range
        </h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {others.map((p) => {
            const PIcon = iconMap[p.icon];
            return (
              <Link key={p.slug} href={`/products/${p.slug}`} className="group">
                <div className="flex h-full items-center gap-5 overflow-hidden rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-glow">
                  <div className="relative size-28 shrink-0 overflow-hidden rounded-xl">
                    <Image
                      src={p.image}
                      alt={p.name}
                      fill
                      sizes="112px"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div>
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-medium"
                      style={{ color: p.colorHex }}
                    >
                      <PIcon className="size-3.5" />
                      {p.use}
                    </span>
                    <h3 className="mt-1 font-display text-lg font-bold">
                      {p.size} · {p.color}
                    </h3>
                    <p className="text-sm text-muted-foreground">{p.purpose}</p>
                    <span className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary">
                      View details
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="container pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-accent p-8 text-center text-white sm:p-12">
          <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/15 blur-2xl" />
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            Help put ORA in every girl&apos;s hand
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-white/85">
            Donate pads or join our partner network and bring ORA to your school
            or community.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/donate"
              className={cn(
                buttonVariants({ size: "lg" }),
                "rounded-full bg-white text-primary hover:bg-white/90",
              )}
            >
              <HeartHandshake className="size-5" />
              Donate now
            </Link>
            <Link
              href="/request-access"
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "rounded-full border-white/40 bg-white/10 text-white hover:bg-white/20",
              )}
            >
              Join us
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
