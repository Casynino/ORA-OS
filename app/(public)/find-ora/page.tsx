import type { Metadata } from "next";
import { ArrowDown, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { CoverageMap, type StockistDTO } from "@/components/public/coverage-map";
import { PageHero, SectionHead, btnGhost, btnPrimary } from "@/components/site/page-hero";
import { Atmosphere, Rise } from "@/components/site/motion";
import { CountUp } from "@/components/ui/count-up";
import { HeroPacks } from "@/components/site/pages/find-ora/hero-packs";
import { StockistBand } from "@/components/site/pages/find-ora/stockist-band";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Find ORA",
  description:
    "ORA pads are available across Tanzania — pharmacies, supermarkets, shops and community points. Explore our growing coverage map and find ORA near you.",
};

export const dynamic = "force-dynamic";

/*
 * Find ORA (cinematic pass, 2026-11-09): a chapter of the same night site as the home page. A full-bleed crowd photo
 * opens it with the packs floating at the right; the live figures follow in huge type, then every covered region runs
 * past as an outlined ticker. [01] is the live map with its search, filters and a region index; [02] the directory of
 * every outlet; [03] closes on one ORA-pink band with the arch and the packs.
 */
const STAT_EDGES = [
  "pr-5 sm:pr-8",
  "border-l pl-5 sm:pl-8 lg:pr-8",
  "border-t pr-5 sm:pr-8 lg:border-l lg:border-t-0 lg:pl-8",
  "border-l border-t pl-5 sm:pl-8 lg:border-t-0",
];

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
    { label: "Regions covered", value: regions },
    { label: "Districts reached", value: districts },
    { label: "Active stockists", value: stockists.length },
    { label: "Distribution partners", value: partners },
  ];

  // Covered regions, most outlets first, for the ticker under the figures.
  const byRegion = new Map<string, { name: string; count: number }>();
  for (const s of stockists) {
    const key = s.region.trim().toLowerCase();
    const r = byRegion.get(key) ?? { name: s.region.trim(), count: 0 };
    r.count++;
    byRegion.set(key, r);
  }
  const regionList = [...byRegion.values()].sort((a, b) => b.count - a.count);
  const ticker = regionList.length > 0 && regionList.length < 6 ? [...regionList, ...regionList, ...regionList] : regionList;

  return (
    <>
      {/* Opening: the crowd, the promise, the packs */}
      <div className="relative">
        <PageHero
          variant="cover"
          image="/ora/site/wide-GTM00117.jpg"
          imageAlt="A crowd of girls gathered outdoors at an ORA event"
          label="Availability & coverage"
          title="ORA is near you"
          accent={["you"]}
          intro="From pharmacies to supermarkets to community points — our network keeps growing across Tanzania. Explore it live."
          actions={
            <>
              <a href="#map" className={btnPrimary}>
                Explore the map
                <ArrowDown className="size-4" strokeWidth={1.75} aria-hidden="true" />
              </a>
              <a href="#outlets" className={btnGhost}>
                See every outlet
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={1.5} aria-hidden="true" />
              </a>
            </>
          }
        />
        <HeroPacks />
      </div>

      {/* The live figures, big */}
      <section className="relative border-y border-white/10">
        <dl className="mx-auto grid max-w-[1440px] grid-cols-2 px-5 sm:px-8 lg:grid-cols-4">
          {stats.map((s, i) => (
            <Rise key={s.label} delay={i * 0.08} className={cn("border-white/10 py-8 sm:py-12", STAT_EDGES[i])}>
              <dt className="s-label !leading-[1.6]">
                <span className="text-[rgb(var(--s-pink))]">0{i + 1}</span>
                <span aria-hidden className="mx-2 text-white/25">/</span>
                {s.label}
              </dt>
              <dd className="mt-4 font-site-display text-[clamp(2.9rem,7vw,6.2rem)] font-semibold leading-none tracking-[-0.045em] tabular-nums">
                <CountUp value={s.value} />
              </dd>
            </Rise>
          ))}
        </dl>
      </section>


      {/* [01] The live map — and [02] the directory, which shares its search */}
      <section id="map" className="relative isolate scroll-mt-16 pb-24 pt-20 sm:pb-32 sm:pt-28">
        <Atmosphere variant="c" grid={false} className="-z-10 opacity-60" />
        <div className="relative mx-auto max-w-[1440px] px-5 sm:px-8">
          <CoverageMap
            stockists={stockists as StockistDTO[]}
            intro={
              <SectionHead
                index="01"
                label="Live coverage"
                aside="Tap a region"
                title="Tap a region, see every outlet"
                accent={["outlet"]}
                note="Search by region, district or store, or pick the kind of place you shop at. The map and the list of outlets below follow along."
              />
            }
          />
        </div>
      </section>

      {/* [03] Become a stockist */}
      <StockistBand />
    </>
  );
}
