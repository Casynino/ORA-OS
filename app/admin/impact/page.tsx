import Link from "next/link";
import { HeartHandshake, Package, Users, ExternalLink, Sparkles } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { ImpactManager, type ActivityRow, type StoryRow } from "@/components/admin/impact-manager";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminImpactPage() {
  await requireRole("ADMIN");

  const [activities, stories] = await Promise.all([
    prisma.impactActivity.findMany({ orderBy: { activityDate: "desc" } }),
    prisma.impactStory.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        personName: true,
        location: true,
        quote: true,
        published: true,
      },
    }),
  ]);

  const published = activities.filter((a) => a.isPublished);
  const pads = published.reduce((s, a) => s + a.padsDistributed, 0);
  const people = published.reduce((s, a) => s + a.peopleReached, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Impact management"
        description="Record every visit, session and distribution — the public Impact page and counters update automatically."
      >
        <Link
          href="/impact"
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          View public page
          <ExternalLink className="size-3.5" />
        </Link>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Published activities" value={formatNumber(published.length)} icon={Sparkles} accent="primary" hint={activities.length !== published.length ? `${activities.length - published.length} hidden` : undefined} />
        <StatCard label="Pads distributed (activities)" value={formatNumber(pads)} icon={Package} accent="accent" />
        <StatCard label="People reached (activities)" value={formatNumber(people)} icon={Users} accent="success" />
        <StatCard label="Impact stories" value={formatNumber(stories.length)} icon={HeartHandshake} accent="info" />
      </div>

      <ImpactManager
        activities={activities as ActivityRow[]}
        stories={stories as StoryRow[]}
      />
    </div>
  );
}
