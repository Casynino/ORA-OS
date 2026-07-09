import Link from "next/link";
import Image from "next/image";
import {
  Heart,
  ArrowRight,
  MapPin,
  Package,
  HeartHandshake,
  Users,
  ShieldCheck,
  GraduationCap,
  CalendarHeart,
  Phone,
  Mail,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { CountUp } from "@/components/ui/count-up";
import { Logo } from "@/components/brand/logo";
import { LandingHeader } from "@/components/public/landing-header";
import { ProductShowcase } from "@/components/public/product-showcase";
import { CampaignMarquee } from "@/components/public/campaign-marquee";
import { AuroraBackground } from "@/components/public/aurora-background";
import { SocialLinks } from "@/components/public/social-links";
import { ORA_CONTACT } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getPublicImpactStats } from "@/lib/stats";
import { getImpactFeed } from "@/lib/services/impact";
import { ImpactPulse } from "@/components/public/impact-live";

// Always render the public impact figures live from the database (never a
// build-time snapshot), so impact stats are always current.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const stats = await getPublicImpactStats();
  const impactFeed = await getImpactFeed();

  const heroStats = [
    { label: "Regions Covered", value: stats.regionsCovered, suffix: "+", icon: MapPin },
    { label: "Packs Distributed", value: stats.padsDistributed, suffix: "+", icon: Package },
    { label: "Girls Reached", value: stats.girlsReached, suffix: "+", icon: HeartHandshake },
    { label: "Communities Supported", value: stats.communities, suffix: "+", icon: Users },
  ];

  const features = [
    { icon: ShieldCheck, title: "Premium Quality", body: "High-quality pads designed for comfort and protection." },
    { icon: GraduationCap, title: "Education First", body: "Empowering girls with knowledge about their bodies and health." },
    { icon: Users, title: "Community Impact", body: "Working with schools, communities and partners to create change." },
    { icon: Heart, title: "Dignity for All", body: "Every girl deserves to live her life with dignity and confidence." },
  ];

  const newsPosts = await prisma.newsPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
    take: 3,
  });
  const news = newsPosts.map((n) => ({
    slug: n.slug,
    title: n.title,
    date: n.publishedAt.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    img: n.coverImage ?? "/ora/event/e09.jpg",
  }));
  const activities = ["/ora/event/e28.jpg", "/ora/event/e06.jpg", "/ora/event/e08.jpg", "/ora/event/e32.jpg"];

  return (
    <>
      <AuroraBackground />
      <LandingHeader />

      {/* Hero */}
      <section className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/ora/gallery/g4.jpg"
            alt="ORA community in Tanzania"
            fill
            priority
            sizes="100vw"
            className="animate-ken-burns object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0d0016] via-[#0d0016]/85 to-[#0d0016]/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0016] via-transparent to-[#0d0016]/50" />
        </div>

        <div className="container relative z-10 flex min-h-screen flex-col justify-center pb-16 pt-28">
          <Reveal>
            <h1 className="font-display text-5xl font-extrabold leading-[1.04] text-white sm:text-6xl lg:text-7xl">
              Empowering
              <br />
              <span className="text-gradient">Every Cycle</span>
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-xl text-lg text-white/75">
              ORA-Pads is building a world where every girl can manage her period
              with dignity, confidence and access. Together, we create healthier
              communities.
            </p>
          </Reveal>
          <Reveal delay={0.18}>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/impact" className={cn(buttonVariants({ size: "lg" }), "rounded-full shadow-glow")}>
                <Heart className="size-5" />
                Join the Movement
              </Link>
              <Link href="/find-ora" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "rounded-full border-white/25 bg-white/5 text-white hover:bg-white/10")}>
                Find ORA Near You
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </Reveal>

          <Reveal delay={0.26}>
            <div className="mt-12 grid max-w-4xl grid-cols-2 gap-3 lg:grid-cols-4">
              {heroStats.map((s) => (
                <div key={s.label} className="glass-card rounded-2xl p-4">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white">
                    <s.icon className="size-4" />
                  </span>
                  <div className="mt-3 font-display text-2xl font-bold text-white">
                    <CountUp value={s.value} suffix={s.suffix ?? ""} />
                  </div>
                  <div className="text-xs text-white/60">{s.label}</div>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.34}>
            <ImpactPulse initial={impactFeed} className="mt-5" />
          </Reveal>
        </div>
      </section>

      {/* Why Ora Exists */}
      <section id="about" className="container py-20 sm:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <div className="flex items-center gap-2 text-primary">
              <span className="h-px w-8 bg-primary" />
              <Heart className="size-4 fill-primary" />
              <span className="h-px w-8 bg-primary" />
            </div>
            <h2 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">
              Why Ora Exists
            </h2>
            <p className="mt-5 text-lg text-muted-foreground">
              We believe no girl should miss school, feel unprepared, or lack
              confidence because of her period. We provide products, education and
              support that transform lives.
            </p>
            <Link href="/impact" className={cn(buttonVariants(), "mt-7 rounded-full")}>
              Meet the Movement
              <ArrowRight className="size-4" />
            </Link>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative col-span-1 row-span-2 aspect-[3/4] overflow-hidden rounded-2xl">
                <Image src="/ora/lifestyle-1.jpg" alt="An ORA girl" fill sizes="(max-width:1024px) 50vw, 25vw" className="object-cover" />
              </div>
              <div className="relative aspect-square overflow-hidden rounded-2xl">
                <Image src="/ora/gallery/g6.jpg" alt="ORA event" fill sizes="(max-width:1024px) 50vw, 25vw" className="object-cover" />
              </div>
              <div className="relative aspect-square overflow-hidden rounded-2xl">
                <Image src="/ora/gallery/g5.jpg" alt="ORA school visit" fill sizes="(max-width:1024px) 50vw, 25vw" className="object-cover" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Feature cards */}
      <section className="container pb-8">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.08}>
              <div className="glass-card glow-hover h-full rounded-2xl p-6 text-center">
                <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-glow">
                  <f.icon className="size-6" />
                </span>
                <h3 className="mt-4 font-display text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Products */}
      <div id="products">
        <ProductShowcase />
      </div>

      {/* Brand campaign reel */}
      <section className="py-16">
        <Reveal className="container mx-auto max-w-2xl text-center">
          <div className="flex items-center justify-center gap-2 text-primary">
            <span className="h-px w-8 bg-primary" />
            <Sparkles className="size-4" />
            <span className="h-px w-8 bg-primary" />
          </div>
          <h2 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            ORA in real life
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Real girls, real schools, real impact — ORA across Tanzania.
          </p>
        </Reveal>
        <div className="mt-10">
          <CampaignMarquee />
        </div>
      </section>

      {/* Action cards */}
      <section className="container py-8">
        <div className="grid gap-5 lg:grid-cols-3">
          <Reveal>
            <div className="glow-hover relative h-full overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary/40 p-7">
              <h3 className="font-display text-2xl font-bold text-white">Make an Impact Today</h3>
              <p className="mt-2 max-w-[18rem] text-sm text-white/85">Every school visit, every education session, every pad delivered — see the change we create together.</p>
              <Link href="/impact" className={cn(buttonVariants(), "mt-6 rounded-full bg-white text-primary hover:bg-white/90")}>
                <Heart className="size-4" />
                See Our Impact
              </Link>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="glow-hover relative h-full overflow-hidden rounded-3xl bg-gradient-to-br from-accent to-accent/40 p-7">
              <h3 className="font-display text-2xl font-bold text-white">Join the Movement</h3>
              <p className="mt-2 max-w-[18rem] text-sm text-white/85">Bring ORA to your school or community — agents, distributors, NGOs and schools all welcome.</p>
              <Link href="/request-access" className={cn(buttonVariants(), "mt-6 rounded-full bg-white text-accent hover:bg-white/90")}>
                Join Us
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="glow-hover relative h-full overflow-hidden rounded-3xl border border-primary/30 bg-secondary/40 p-7">
              <div className="absolute -right-6 -top-6 size-24 rounded-full bg-primary/30 blur-2xl" />
              <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-glow">
                <CalendarHeart className="size-6" />
              </span>
              <h3 className="mt-4 font-display text-2xl font-bold">Period Tracker</h3>
              <p className="mt-2 max-w-[18rem] text-sm text-muted-foreground">Track your cycle, get insights and take control of your health.</p>
              <Link href="/tracker" className={cn(buttonVariants({ variant: "outline" }), "mt-6 rounded-full")}>
                Track Now
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* News + Activities */}
      <section className="container py-20">
        <div className="grid gap-12 lg:grid-cols-2">
          <Reveal id="news">
            <h2 className="font-display text-3xl font-bold tracking-tight">Latest News</h2>
            <p className="mt-2 text-muted-foreground">Stay updated with our latest stories and announcements.</p>
            <Link href="/news" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              View All News <ArrowRight className="size-4" />
            </Link>
            <div className="mt-6 space-y-4">
              {news.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No posts yet — check back soon.
                </p>
              )}
              {news.map((n) => (
                <Link
                  key={n.slug}
                  href={`/news/${n.slug}`}
                  className="glass-card glow-hover flex items-center gap-4 rounded-2xl p-3 transition hover:-translate-y-0.5"
                >
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-xl">
                    <Image src={n.img} alt={n.title} fill sizes="64px" className="object-cover" />
                  </div>
                  <div>
                    <h4 className="font-semibold leading-snug">{n.title}</h4>
                    <p className="text-xs text-muted-foreground">{n.date}</p>
                  </div>
                </Link>
              ))}
            </div>
          </Reveal>

          <Reveal id="activities" delay={0.1}>
            <h2 className="font-display text-3xl font-bold tracking-tight">Recent Activities</h2>
            <p className="mt-2 text-muted-foreground">Moments from our community outreach and empowerment programs.</p>
            <Link href="/impact" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              View All Activities <ArrowRight className="size-4" />
            </Link>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {activities.map((a) => (
                <div key={a} className="group relative aspect-[4/3] overflow-hidden rounded-2xl">
                  <Image src={a} alt="ORA activity" fill sizes="(max-width:1024px) 50vw, 25vw" className="object-cover transition-transform duration-700 group-hover:scale-110" />
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0d0016] text-white">
        <div className="container grid gap-10 py-14 lg:grid-cols-4">
          <div>
            <Logo mark="light" />
            <p className="mt-4 max-w-xs text-sm text-white/60">
              Empowering every cycle. Building healthier communities.
            </p>
            <SocialLinks
              className="mt-5"
              itemClassName="bg-white/10 text-white/80 hover:bg-primary hover:text-white"
              iconClassName="size-4"
            />
          </div>

          <div>
            <h4 className="font-semibold">Get in touch</h4>
            <ul className="mt-3 space-y-3 text-sm text-white/60">
              <li>
                <a
                  href={ORA_CONTACT.phoneHref}
                  aria-label="Call ORA customer care"
                  className="flex items-start gap-2.5 transition-colors hover:text-primary"
                >
                  <Phone className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    <span className="block text-xs uppercase tracking-wide text-white/40">
                      Customer Care
                    </span>
                    <span className="font-medium text-white">
                      {ORA_CONTACT.phoneDisplay}
                    </span>
                  </span>
                </a>
              </li>
              <li>
                <a
                  href={ORA_CONTACT.emailHref}
                  aria-label="Email ORA"
                  className="flex items-start gap-2.5 transition-colors hover:text-primary"
                >
                  <Mail className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    <span className="block text-xs uppercase tracking-wide text-white/40">
                      Email
                    </span>
                    <span className="font-medium text-white">
                      {ORA_CONTACT.email}
                    </span>
                  </span>
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold">Quick Links</h4>
            <ul className="mt-3 space-y-2 text-sm text-white/60">
              {[["Home", "/"], ["Impact", "/impact"], ["Products", "#products"], ["Education", "/education"], ["Contact", "/contact"]].map(([l, h]) => (
                <li key={l}><Link href={h} className="hover:text-primary">{l}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold">Get Involved</h4>
            <ul className="mt-3 space-y-2 text-sm text-white/60">
              {[["Our Impact", "/impact"], ["Find ORA", "/find-ora"], ["Join Us", "/request-access"], ["Sign in", "/login"]].map(([l, h]) => (
                <li key={l}><Link href={h} className="hover:text-primary">{l}</Link></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <p className="container py-5 text-center text-xs text-white/50">
            © {new Date().getFullYear()} ORA-Pads. All rights reserved.
          </p>
        </div>
      </footer>
    </>
  );
}
