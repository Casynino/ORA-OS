import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { CoverageMap, type StockistDTO } from "@/components/public/coverage-map";
import { ArchPhoto } from "@/components/public/arch-photo";
import { Reveal } from "@/components/ui/reveal";
import { CountUp } from "@/components/ui/count-up";

export const metadata: Metadata = {
  title: "Find ORA",
  description:
    "ORA pads are available across Tanzania — pharmacies, supermarkets, shops and community points. Explore our growing coverage map and find ORA near you.",
};

export const dynamic = "force-dynamic";

/*
 * Find ORA (unslop pass, 2026-11-09): the map is the hero — heading, live figures and the search sit beside it on large
 * screens and above it on phones. Every outlet follows as a hairline directory. The page ends on one flat plum block
 * with the ORA arch framing packs on a school-event table.
 */
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

  const intro = (
    <>
      <p className="ora-rise text-sm font-medium text-primary">Availability & coverage</p>
      <h1 className="ora-rise ora-rise-1 mt-4 text-balance font-display text-4xl font-semibold leading-[1.05] tracking-[-0.025em] sm:text-5xl lg:text-6xl">
        ORA is <span className="text-primary">near you</span>
      </h1>
      <p className="ora-rise ora-rise-2 mt-6 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
        From pharmacies to supermarkets to community points — our network keeps growing across Tanzania. Explore it
        live.
      </p>

      {/* Live stats */}
      <dl className="ora-rise ora-rise-3 mt-10 grid max-w-xl grid-cols-2 gap-x-8 gap-y-6 border-t border-border pt-7 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col-reverse justify-end">
            <dt className="mt-1.5 text-[13px] leading-snug text-muted-foreground">{s.label}</dt>
            <dd className="font-display text-3xl font-semibold tabular-nums tracking-[-0.02em]">
              <CountUp value={s.value} />
            </dd>
          </div>
        ))}
      </dl>
    </>
  );

  return (
    <>
      {/* Hero + map experience + outlet directory */}
      <section className="container pb-20 pt-16 sm:pb-28 sm:pt-20">
        <CoverageMap stockists={stockists as StockistDTO[]} intro={intro} />
      </section>

      {/* Become a stockist */}
      <section className="container pb-20 sm:pb-28">
        <Reveal>
          <div className="grid grid-cols-1 overflow-hidden rounded-2xl bg-[#2a0845] text-white sm:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
            <div className="self-center p-8 sm:p-12 lg:p-16">
              <h2 className="text-balance font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
                Want ORA on your shelves?
              </h2>
              <p className="mt-4 max-w-md text-[17px] leading-relaxed text-white/75">
                Pharmacies, shops, schools and NGOs across Tanzania partner with ORA every month. Join the network.
              </p>
              <Link
                href="/request-access"
                className="mt-8 inline-flex h-12 items-center rounded-full bg-white px-6 text-[15px] font-medium text-[#2a0845] transition-[background-color,transform] duration-150 hover:bg-white/90 active:scale-[0.97]"
              >
                Become a stockist
              </Link>
            </div>
            <div className="flex items-end justify-center px-8 sm:justify-start sm:px-0 sm:pr-12 sm:pt-12 lg:pr-16">
              <ArchPhoto
                src="/ora/gallery/g2.jpg"
                alt="A student at an ORA school event beside packs of ORA pads stacked on a table"
                sizes="(max-width: 640px) 240px, 300px"
                position="40% 50%"
                outline
                className="-mb-4 w-full max-w-[240px] sm:max-w-[300px]"
              />
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
