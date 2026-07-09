import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Store, MapPin, Handshake, Map } from "lucide-react";
import { prisma } from "@/lib/db";
import { CoverageMap, type StockistDTO } from "@/components/public/coverage-map";
import { Reveal } from "@/components/ui/reveal";
import { CountUp } from "@/components/ui/count-up";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Find ORA",
  description:
    "ORA pads are available across Tanzania — pharmacies, supermarkets, shops and community points. Explore our growing coverage map and find ORA near you.",
};

export const dynamic = "force-dynamic";

export default async function FindOraPage() {
  const [stockists, partners] = await Promise.all([
    prisma.stockist.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, type: true, region: true, district: true,
        address: true, phone: true, hours: true, products: true, lat: true, lng: true,
      },
    }),
    prisma.user.count({ where: { role: "PARTNER", status: "ACTIVE" } }),
  ]);

  const regions = new Set(stockists.map((s) => s.region.trim().toLowerCase())).size;
  const districts = new Set(
    stockists.map((s) => `${s.region}·${s.district}`.toLowerCase()),
  ).size;

  const stats = [
    { label: "Regions covered", value: regions, icon: Map },
    { label: "Districts reached", value: districts, icon: MapPin },
    { label: "Active stockists", value: stockists.length, icon: Store },
    { label: "Distribution partners", value: partners, icon: Handshake },
  ];

  return (
    <div className="relative overflow-hidden">
      {/* Hero */}
      <section className="relative pt-16 sm:pt-24">
        <span className="pointer-events-none absolute left-1/2 top-0 -z-10 size-[40rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/10 blur-3xl" />
        <Reveal className="container text-center">
          <div className="mx-auto flex items-center justify-center gap-2 text-primary">
            <span className="h-px w-8 bg-primary/50" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em]">
              Availability & coverage
            </span>
            <span className="h-px w-8 bg-primary/50" />
          </div>
          <h1 className="mx-auto mt-4 max-w-2xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            ORA is <span className="text-gradient">near you</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground sm:text-lg">
            From pharmacies to supermarkets to community points — our network keeps
            growing across Tanzania. Explore it live.
          </p>
        </Reveal>

        {/* Live stats */}
        <Reveal delay={0.1} className="container mt-10">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-10 gap-y-6 sm:gap-x-14">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-gradient font-display text-3xl font-extrabold tracking-tight tabular-nums sm:text-4xl">
                  <CountUp value={s.value} />
                </div>
                <div className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Map experience */}
      <section className="container py-12 sm:py-16">
        <Reveal>
          <CoverageMap stockists={stockists as StockistDTO[]} />
        </Reveal>
      </section>

      {/* Become a stockist CTA */}
      <section className="container pb-24">
        <Reveal className="mx-auto max-w-4xl">
          <div className="glow-hover relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary via-primary/85 to-accent p-9 text-center sm:p-12">
            <span className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-white/20 blur-3xl" />
            <span className="pointer-events-none absolute -bottom-12 -left-12 size-48 rounded-full bg-white/10 blur-3xl" />
            <h2 className="relative font-display text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
              Want ORA on your shelves?
            </h2>
            <p className="relative mx-auto mt-3 max-w-md text-white/85">
              Pharmacies, shops, schools and NGOs across Tanzania partner with ORA
              every month. Join the network.
            </p>
            <Link
              href="/request-access"
              className={cn(
                buttonVariants({ size: "lg" }),
                "relative mt-6 h-12 rounded-full bg-white px-8 text-base text-primary hover:bg-white/90",
              )}
            >
              Become a stockist
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
