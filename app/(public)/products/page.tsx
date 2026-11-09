import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { products } from "@/lib/products";
import { Reveal } from "@/components/ui/reveal";
import { ArchPhoto } from "@/components/public/arch-photo";

export const metadata: Metadata = {
  title: "Products",
  description:
    "Meet the ORA range — Night, Day and Daily Liners. 100% air-breathable, long-lasting freshness.",
};

/*
 * The ORA range (unslop pass, 2026-11-09): same content, quieter chrome. The packs carry the colour; around them a
 * figure for the size, a small dot in the pack's colour and what it is for. No chips on the photos, no glass cards.
 */
export default function ProductsPage() {
  return (
    <>
      {/* Hero */}
      <section className="container grid grid-cols-1 items-center gap-x-16 gap-y-12 py-16 sm:py-24 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div>
          <p className="ora-rise text-sm font-medium text-primary">The ORA range</p>
          <h1 className="ora-rise ora-rise-1 mt-3 text-balance font-display text-4xl font-semibold leading-[1.05] tracking-[-0.025em] sm:text-5xl lg:text-6xl">
            Three sizes, <span className="text-primary">total confidence</span>
          </h1>
          <p className="ora-rise ora-rise-2 mt-6 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
            Designed for comfort, protection and everyday confidence — 100% air-breathable, long-lasting freshness.
          </p>
        </div>
        <div className="mx-auto hidden w-full max-w-[400px] text-foreground lg:block">
          <ArchPhoto
            src="/ora/campaign/protected-trio.jpg"
            alt="A young woman in an ORA polo holding the three ORA packs"
            sizes="400px"
            position="50% 30%"
            priority
            reveal
            outline
          />
        </div>
      </section>

      {/* The three packs */}
      <section className="container pb-20 sm:pb-28">
        <div className="grid grid-cols-1 gap-x-6 gap-y-12 border-t border-border pt-12 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p, i) => (
            <Reveal key={p.slug} delay={i * 0.06}>
              <Link
                href={`/products/${p.slug}`}
                className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
              >
                <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-muted">
                  <Image
                    src={p.image}
                    alt={p.name}
                    fill
                    sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
                  />
                </div>
                <div className="mt-5">
                  <div className="flex items-baseline justify-between gap-4">
                    <h2 className="font-display text-2xl font-semibold tabular-nums tracking-[-0.02em]">{p.size}</h2>
                    <p className="flex items-center gap-2 text-[15px] text-muted-foreground">
                      <span className="size-2 rounded-full" style={{ background: p.colorHex }} aria-hidden="true" />
                      {p.color}
                    </p>
                  </div>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
                    {p.use} · {p.purpose.toLowerCase()}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-2 text-[15px] font-medium text-primary">
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
    </>
  );
}
