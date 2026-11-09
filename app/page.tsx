import { cn } from "@/lib/utils";
import { siteFontVars } from "@/lib/site-fonts";
import { getCurrentUser } from "@/lib/rbac";
import { listPublicPosts } from "@/lib/services/news";
import { getPublicImpactStats } from "@/lib/stats";
import { getImpactFeed } from "@/lib/services/impact";
import { SiteIntro } from "@/components/site/intro";
import { Galaxy } from "@/components/site/galaxy";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Hero } from "@/components/site/home/hero";
import { Manifesto, RangeIndex, WhereItHappens, CampaignBand, BehindOra, Numbers, GetInvolved, Feed, OnTheGrid, Closing } from "@/components/site/home/sections";
import { SiteCursor } from "@/components/site/cursor";

// Always render the public impact figures live from the database (never a
// build-time snapshot), so impact stats are always current.
export const dynamic = "force-dynamic";

/*
 * The public home page — cinematic redesign (2026-11-09). The owner pointed at the Reckless and Vegas sites: dark,
 * big type, numbered chapters, things that move. Night ground with ORA's pink and violet light, the real ORA model
 * and packs floating in the hero, a manifesto that lights up as it is read, the range on a pinned stage where each
 * pack turns in, values as an index, the campaign line over a real stage, live figures, two rows of real moments,
 * three ways in, the news feed, and the promise to close. Data and links are the same as before.
 */
export default async function HomePage() {
  const [user, stats, feed, posts] = await Promise.all([getCurrentUser(), getPublicImpactStats(), getImpactFeed(), listPublicPosts(4)]);

  const heroStats = [
    { label: "Regions covered", value: stats.regionsCovered },
    { label: "Packs distributed", value: stats.padsDistributed },
    { label: "Girls reached", value: stats.girlsReached },
    { label: "Communities", value: stats.communities },
  ];
  const bigStats = [
    { label: "Packs distributed", value: stats.padsDistributed, note: "Pads delivered straight to girls who need them." },
    { label: "Girls reached", value: stats.girlsReached, note: "Girls supported through school visits and community days." },
    { label: "Regions covered", value: stats.regionsCovered, note: "Regions of Tanzania where ORA is on the ground." },
    { label: "Communities", value: stats.communities, note: "Schools and communities visited with products and education." },
  ];
  const news = posts.map((n) => ({
    slug: n.slug,
    title: n.title,
    date: n.publishedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    img: n.coverImage ?? "/ora/event/e09.jpg",
  }));

  return (
    <div className={cn("ora-site s-grain min-h-screen", siteFontVars)}>
      <SiteIntro />
      <SiteCursor />
      <Galaxy />
      <SiteHeader user={user ? { name: user.name, role: user.role } : null} />
      <main className="relative z-[1]">
        <Hero stats={heroStats} feed={feed} />
        <Manifesto />
        <RangeIndex />
        <WhereItHappens />
        <CampaignBand />
        <BehindOra />
        <Numbers stats={bigStats} />
        <GetInvolved />
        <Feed news={news} />
        <OnTheGrid />
        <Closing />
      </main>
      <div className="relative z-[1]">
        <SiteFooter />
      </div>
    </div>
  );
}
