import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { products } from "@/lib/products";
import { Reveal } from "@/components/ui/reveal";

/**
 * The three packs. The photos carry the colour; around them everything is quiet — the size as the figure, a small dot
 * in the pack's colour, what it is for. No chips, no icon tiles.
 */
export function ProductShowcase() {
  return (
    <section className="container py-20 sm:py-28">
      <Reveal className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
        <div>
          <p className="text-sm font-medium text-primary">Three sizes</p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.025em] sm:text-5xl">Meet the ORA range</h2>
        </div>
        <p className="max-w-md text-[17px] leading-relaxed text-muted-foreground">
          Designed for comfort, protection and everyday confidence. 100% air breathable, long-lasting freshness.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p, i) => (
          <Reveal key={p.slug} delay={i * 0.06}>
            <Link href={`/products/${p.slug}`} className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background">
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-muted">
                <Image
                  src={p.image}
                  alt={`ORA ${p.color} — ${p.size} ${p.purpose}`}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
                />
              </div>
              <div className="mt-5 flex items-start justify-between gap-4">
                <div>
                  <p className="font-display text-2xl font-semibold tabular-nums tracking-[-0.02em]">{p.size}</p>
                  <p className="mt-1.5 flex items-center gap-2 text-[15px] text-muted-foreground">
                    <span className="size-2 rounded-full" style={{ background: p.colorHex }} aria-hidden="true" />
                    {p.use} · {p.purpose.toLowerCase()}
                  </p>
                </div>
                <ArrowRight
                  className="mt-2 size-5 shrink-0 text-muted-foreground transition-[transform,color] duration-150 group-hover:translate-x-0.5 group-hover:text-primary"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </div>
            </Link>
          </Reveal>
        ))}
      </div>

      <p className="mt-12 text-[15px] text-muted-foreground">
        Want to bring ORA to your school or community?{" "}
        <Link href="/request-access" className="font-medium text-primary underline-offset-4 hover:underline">
          Partner with us
        </Link>
      </p>
    </section>
  );
}
