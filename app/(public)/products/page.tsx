import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Moon, Sun, Sparkles, ArrowRight } from "lucide-react";
import { products } from "@/lib/products";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";

const iconMap = { moon: Moon, sun: Sun, sparkles: Sparkles } as const;

export const metadata: Metadata = {
  title: "Products",
  description:
    "Meet the ORA range — Night, Day and Daily Liners. 100% air-breathable, long-lasting freshness.",
};

export default function ProductsPage() {
  return (
    <div className="container py-16">
      <Reveal className="mx-auto max-w-2xl text-center">
        <Badge variant="accent" className="mx-auto">
          The ORA range
        </Badge>
        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Three sizes, <span className="text-gradient">total confidence</span>
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Designed for comfort, protection and everyday confidence — 100%
          air-breathable, long-lasting freshness.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p, i) => {
          const Icon = iconMap[p.icon];
          return (
            <Reveal key={p.slug} delay={i * 0.1}>
              <Link href={`/products/${p.slug}`} className="group block h-full">
                <div className="flex h-full flex-col overflow-hidden rounded-3xl glass-card glow-hover">
                  <div className="relative aspect-[4/5] overflow-hidden">
                    <Image
                      src={p.image}
                      alt={p.name}
                      fill
                      sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                      <Icon className="size-3.5" />
                      {p.use}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-xl font-bold">{p.size}</h3>
                      <Badge variant="secondary">{p.color}</Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {p.purpose}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                      View details
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
