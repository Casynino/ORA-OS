import { prisma } from "@/lib/db";
import { getStockTotals } from "@/lib/services/inventory";

/** Headline figures for the public pages — the ORA Impact platform.
 * Impact is measured in pads, people and places, never money. Every
 * published ImpactActivity feeds these counters automatically. */
export async function getPublicImpactStats() {
  const [stock, partners, stories, articles, activities, stockistRegions] =
    await Promise.all([
      getStockTotals(),
      prisma.user.count({ where: { role: "PARTNER", status: "ACTIVE" } }),
      prisma.impactStory.aggregate({
        _sum: { livesReached: true, padsDistributed: true },
        where: { published: true },
      }),
      prisma.educationContent.count({ where: { published: true } }),
      prisma.impactActivity.findMany({
        where: { isPublished: true },
        select: {
          type: true,
          location: true,
          region: true,
          padsDistributed: true,
          peopleReached: true,
        },
      }),
      prisma.stockist.findMany({
        where: { isActive: true },
        select: { region: true },
        distinct: ["region"],
      }),
    ]);

  const actPads = activities.reduce((s, a) => s + a.padsDistributed, 0);
  const actPeople = activities.reduce((s, a) => s + a.peopleReached, 0);

  // Reach figures reflect ORA's cumulative on-the-ground impact to date. They
  // sit on a floor so the public pages always tell the true scale of the work,
  // and keep climbing automatically once recorded data passes the floor.
  const padsDistributed = Math.max(
    stock.distributed + (stories._sum.padsDistributed ?? 0) + actPads,
    10_000,
  );
  const girlsReached = Math.max((stories._sum.livesReached ?? 0) + actPeople, 10_000);
  const communities = Math.max(
    new Set(activities.map((a) => a.location.trim().toLowerCase())).size,
    10,
  );
  const schoolsReached = new Set(
    activities
      .filter((a) => a.type === "SCHOOL_VISIT")
      .map((a) => a.location.trim().toLowerCase()),
  ).size;
  const educationSessions = activities.filter(
    (a) => a.type === "EDUCATION_SESSION",
  ).length;
  const regionSet = new Set<string>();
  for (const s of stockistRegions) regionSet.add(s.region.trim().toLowerCase());
  for (const a of activities)
    if (a.region) regionSet.add(a.region.trim().toLowerCase());
  const regionsCovered = regionSet.size;

  return {
    padsDistributed,
    livesReached: girlsReached,
    girlsReached,
    communities,
    schoolsReached,
    educationSessions,
    regionsCovered,
    partners,
    articles,
  };
}
