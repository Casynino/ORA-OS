import Image from "next/image";
import Link from "next/link";
import { Moon, Sun, Sparkles, ArrowRight } from "lucide-react";
import { products } from "@/lib/products";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";

const iconMap = { moon: Moon, sun: Sun, sparkles: Sparkles } as const;

export function ProductShowcase() {
  return (
    <section className="container py-20">
      <Reveal className="mx-auto max-w-2xl text-center">
        <Badge variant="accent" className="mx-auto">
          Available sizes
        </Badge>
        <h2 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Meet the ORA range
        </h2>
        <p className="mt-3 text-lg text-muted-foreground">
          Designed for comfort, protection and everyday confidence. 100% air
          breathable, long-lasting freshness.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p, i) => {
          const Icon = iconMap[p.icon];
          return (
            <Reveal key={p.slug} delay={i * 0.1}>
              <Link href={`/products/${p.slug}`} className="group block h-full">
                <div className="h-full overflow-hidden rounded-3xl glass-card glow-hover">
                  <div className="relative aspect-[4/5] overflow-hidden">
                    <Image
                      src={p.image}
                      alt={`ORA ${p.color} — ${p.size} ${p.purpose}`}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                      <Icon className="size-3.5" />
                      {p.use}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 p-5">
                    <span
                      className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-white"
                      style={{ background: p.colorHex }}
                    >
                      <Icon className="size-5" />
                    </span>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-xl font-bold">
                          {p.size}
                        </h3>
                        <Badge variant="secondary">{p.color}</Badge>
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {p.purpose}
                      </p>
                    </div>
                    <ArrowRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                  </div>
                </div>
              </Link>
            </Reveal>
          );
        })}
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Want to bring ORA to your school or community?{" "}
        <Link
          href="/request-access"
          className="font-medium text-primary hover:underline"
        >
          Partner with us →
        </Link>
      </p>
    </section>
  );
}
