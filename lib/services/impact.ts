import { prisma } from "@/lib/db";

export type ImpactFeedItem = {
  id: string;
  title: string;
  type: string;
  location: string;
  region: string | null;
  padsDistributed: number;
  peopleReached: number;
  at: string; // ISO date
};

/** Latest published activities — powers the public impact feed & pulse. */
export async function getImpactFeed(take = 12): Promise<ImpactFeedItem[]> {
  const rows = await prisma.impactActivity.findMany({
    where: { isPublished: true },
    orderBy: { activityDate: "desc" },
    take,
    select: {
      id: true,
      title: true,
      type: true,
      location: true,
      region: true,
      padsDistributed: true,
      peopleReached: true,
      activityDate: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    location: r.location,
    region: r.region,
    padsDistributed: r.padsDistributed,
    peopleReached: r.peopleReached,
    at: r.activityDate.toISOString(),
  }));
}
