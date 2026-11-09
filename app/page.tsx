import Link from "next/link";
import Image from "next/image";
import { Heart, ArrowRight, Users, ShieldCheck, GraduationCap, CalendarHeart, Phone, Mail } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { CountUp } from "@/components/ui/count-up";
import { Logo } from "@/components/brand/logo";
import { LandingHeader } from "@/components/public/landing-header";
import { ProductShowcase } from "@/components/public/product-showcase";
import { CampaignMarquee } from "@/components/public/campaign-marquee";
import { ArchPhoto } from "@/components/public/arch-photo";
import { SocialLinks } from "@/components/public/social-links";
import { ORA_CONTACT } from "@/lib/constants";
import { listPublicPosts } from "@/lib/services/news";
import { getPublicImpactStats } from "@/lib/stats";
import { getImpactFeed } from "@/lib/services/impact";
import { ImpactPulse } from "@/components/public/impact-live";

// Always render the public impact figures live from the database (never a
// build-time snapshot), so impact stats are always current.
export const dynamic = "force-dynamic";

/*
 * The public home page (refreshed 2026-11-09 with the unslop pass: owner asked for a fresher, calmer look that no
 * longer reads as AI-made, without changing too much). Same sections in the same order. The colour lives in the real
 * photos and the packs; the chrome is quiet — one magenta accent, hairlines, no glass, glows, gradient tiles or pills
 * around labels. ORA's signature is the arch of its logo, used as the window for the photos that carry the brand.
 * Motion: one entrance on load (the arch rises, the words follow), a fade-and-rise as sections come into view.
 */

const PINK = "text-[hsl(322_100%_72%)]"; // ORA magenta, lifted for text on the plum ground

export default async function HomePage() {
  const stats = await getPublicImpactStats();
  const impactFeed = await getImpactFeed();

  const heroStats = [
    { label: "Regions covered", value: stats.regionsCovered },
    { label: "Packs distributed", value: stats.padsDistributed },
    { label: "Girls reached", value: stats.girlsReached },
    { label: "Communities supported", value: stats.communities },
  ];

  const features = [
    { icon: ShieldCheck, title: "Premium quality", body: "High-quality pads designed for comfort and protection." },
    { icon: GraduationCap, title: "Education first", body: "Empowering girls with knowledge about their bodies and health." },
    { icon: Users, title: "Community impact", body: "Working with schools, communities and partners to create change." },
    { icon: Heart, title: "Dignity for all", body: "Every girl deserves to live her life with dignity and confidence." },
  ];

  const newsPosts = await listPublicPosts(3);
  const news = newsPosts.map((n) => ({
    slug: n.slug,
    title: n.title,
    date: n.publishedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    img: n.coverImage ?? "/ora/event/e09.jpg",
  }));
  const activities = ["/ora/event/e28.jpg", "/ora/event/e06.jpg", "/ora/event/e08.jpg", "/ora/event/e32.jpg"];

  return (
    <>
      <LandingHeader />

      {/* ── Hero: the words on the plum ground, the ORA stage in the arch ── */}
      <section className="relative overflow-hidden bg-[#0d0016] text-white">
        <div className="container grid min-h-[100svh] grid-cols-1 content-center gap-x-16 gap-y-12 pb-16 pt-[calc(var(--sat)+7rem)] lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:pb-20 lg:pt-[calc(var(--sat)+8rem)]">
          <div className="lg:col-start-1 lg:row-start-1 lg:self-end">
            <p className="ora-rise text-sm text-white/60">ORA Pads · Tanzania</p>
            <h1 className="ora-rise ora-rise-1 mt-5 text-balance font-display text-[44px] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-6xl lg:text-[76px]">
              Empowering <span className={PINK}>every cycle</span>
            </h1>
            <p className="ora-rise ora-rise-2 mt-6 max-w-xl text-lg leading-relaxed text-white/70">
              ORA-Pads is building a world where every girl can manage her period with dignity, confidence and access.
              Together, we create healthier communities.
            </p>
            <div className="ora-rise ora-rise-3 mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
              <Link
                href="/impact"
                className="inline-flex h-12 items-center rounded-full bg-primary px-6 text-[15px] font-medium text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.97]"
              >
                Join the movement
              </Link>
              <Link href="/find-ora" className="group inline-flex h-12 items-center gap-2 text-[15px] text-white/80 transition-colors hover:text-white">
                Find ORA near you
                <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[340px] text-white sm:max-w-[420px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:max-w-[500px] lg:self-center">
            <ArchPhoto
              src="/ora/hero-stage.jpg"
              alt="An ORA host on stage holding up a pack of ORA pads, with packs stacked beside her"
              sizes="(max-width: 640px) 340px, (max-width: 1024px) 420px, 500px"
              position="50% 32%"
              priority
              reveal
              outline
            />
          </div>

          <div className="ora-rise ora-rise-4 lg:col-start-1 lg:row-start-2 lg:self-start">
            <dl className="grid max-w-xl grid-cols-2 gap-x-8 gap-y-6 border-t border-white/10 pt-7 sm:grid-cols-4">
              {heroStats.map((s) => (
                <div key={s.label} className="flex flex-col-reverse">
                  <dt className="mt-1.5 text-[13px] leading-snug text-white/55">{s.label}</dt>
                  <dd className="font-display text-3xl font-semibold tabular-nums tracking-[-0.02em]">
                    <CountUp value={s.value} suffix="+" />
                  </dd>
                </div>
              ))}
            </dl>
            <ImpactPulse initial={impactFeed} className="mt-6" />
          </div>
        </div>
      </section>

      {/* ── Why ORA exists ── */}
      <section id="about" className="container scroll-mt-20 py-24 sm:py-32">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <Reveal className="order-2 lg:order-1">
            <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] items-end gap-4 text-foreground">
              <ArchPhoto src="/ora/lifestyle-1.jpg" alt="A girl holding a pack of ORA pads" sizes="(max-width: 1024px) 50vw, 26vw" position="50% 25%" outline />
              <div className="grid gap-4">
                <div className="relative aspect-square overflow-hidden rounded-2xl">
                  <Image src="/ora/gallery/g6.jpg" alt="ORA on stage at a school event" fill sizes="(max-width: 1024px) 45vw, 22vw" className="object-cover" />
                </div>
                <div className="relative aspect-square overflow-hidden rounded-2xl">
                  <Image src="/ora/gallery/g5.jpg" alt="Students at an ORA school visit" fill sizes="(max-width: 1024px) 45vw, 22vw" className="object-cover" />
                </div>
              </div>
            </div>
          </Reveal>
          <Reveal className="order-1 lg:order-2">
            <p className="text-sm font-medium text-primary">Why ORA exists</p>
            <h2 className="mt-3 text-balance font-display text-4xl font-semibold leading-[1.08] tracking-[-0.025em] sm:text-5xl">
              No girl should miss school because of her period
            </h2>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
              We believe no girl should miss school, feel unprepared, or lack confidence because of her period. We provide
              products, education and support that transform lives.
            </p>
            <Link href="/impact" className="group mt-8 inline-flex items-center gap-2 text-[15px] font-medium text-primary">
              Meet the movement
              <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── What ORA stands for ── */}
      <section className="container pb-8">
        <div className="grid gap-x-10 gap-y-10 border-t border-border pt-10 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.05}>
              <f.icon className="size-5 text-primary" strokeWidth={1.5} aria-hidden="true" />
              <h3 className="mt-5 text-lg font-semibold tracking-[-0.01em]">{f.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{f.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Products ── */}
      <div id="products" className="scroll-mt-16">
        <ProductShowcase />
      </div>

      {/* ── ORA in real life: the reel of arches on the plum ground ── */}
      <section className="overflow-hidden bg-[#0d0016] py-20 text-white sm:py-28">
        <Reveal className="container flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <div>
            <p className={`text-sm font-medium ${PINK}`}>Across Tanzania</p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.025em] sm:text-5xl">ORA in real life</h2>
          </div>
          <p className="max-w-md text-[17px] leading-relaxed text-white/65">Real girls, real schools, real impact — ORA across Tanzania.</p>
        </Reveal>
        <div className="mt-12">
          <CampaignMarquee />
        </div>
      </section>

      {/* ── Ways in ── */}
      <section className="container py-20 sm:py-28">
        <div className="grid gap-5 lg:grid-cols-3">
          <Reveal className="h-full">
            <div className="flex h-full min-h-[260px] flex-col rounded-2xl bg-primary p-8 text-primary-foreground">
              <h3 className="font-display text-2xl font-semibold tracking-[-0.02em]">Make an impact today</h3>
              <p className="mt-3 max-w-[22rem] text-[15px] leading-relaxed text-white/85">
                Every school visit, every education session, every pad delivered — see the change we create together.
              </p>
              <Link href="/impact" className="mt-auto inline-flex h-11 w-fit items-center rounded-full bg-white px-5 text-[15px] font-medium text-primary transition-[background-color,transform] duration-150 hover:bg-white/90 active:scale-[0.97]">
                See our impact
              </Link>
            </div>
          </Reveal>
          <Reveal delay={0.06} className="h-full">
            <div className="flex h-full min-h-[260px] flex-col rounded-2xl bg-[#2a0845] p-8 text-white">
              <h3 className="font-display text-2xl font-semibold tracking-[-0.02em]">Join the movement</h3>
              <p className="mt-3 max-w-[22rem] text-[15px] leading-relaxed text-white/75">
                Bring ORA to your school or community — agents, distributors, NGOs and schools all welcome.
              </p>
              <Link href="/login" className="mt-auto inline-flex h-11 w-fit items-center gap-2 rounded-full bg-white px-5 text-[15px] font-medium text-[#2a0845] transition-[background-color,transform] duration-150 hover:bg-white/90 active:scale-[0.97]">
                Join us
              </Link>
            </div>
          </Reveal>
          <Reveal delay={0.12} className="h-full">
            <div className="flex h-full min-h-[260px] flex-col rounded-2xl border border-border bg-card p-8">
              <CalendarHeart className="size-5 text-primary" strokeWidth={1.5} aria-hidden="true" />
              <h3 className="mt-5 font-display text-2xl font-semibold tracking-[-0.02em]">Period tracker</h3>
              <p className="mt-3 max-w-[22rem] text-[15px] leading-relaxed text-muted-foreground">
                Track your cycle, get insights and take control of your health.
              </p>
              <Link href="/tracker" className="group mt-auto inline-flex h-11 w-fit items-center gap-2 text-[15px] font-medium text-primary">
                Track now
                <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── News + activities ── */}
      <section className="container pb-24 sm:pb-32">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:gap-20">
          <Reveal id="news" className="scroll-mt-20">
            <div className="flex items-end justify-between gap-6">
              <div>
                <h2 className="font-display text-3xl font-semibold tracking-[-0.02em]">Latest news</h2>
                <p className="mt-2 text-[15px] text-muted-foreground">Stay updated with our latest stories and announcements.</p>
              </div>
              <Link href="/news" className="shrink-0 text-[15px] font-medium text-primary underline-offset-4 hover:underline">
                All news
              </Link>
            </div>
            {news.length === 0 ? (
              <p className="mt-8 border-t border-border pt-6 text-[15px] text-muted-foreground">No posts yet — check back soon.</p>
            ) : (
              <ul className="mt-8 divide-y divide-border border-y border-border">
                {news.map((n) => (
                  <li key={n.slug}>
                    <Link href={`/news/${n.slug}`} className="group flex items-center gap-4 py-4">
                      <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                        <Image src={n.img} alt="" fill sizes="64px" className="object-cover" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-medium leading-snug transition-colors group-hover:text-primary">{n.title}</h3>
                        <p className="mt-1 text-[13px] tabular-nums text-muted-foreground">{n.date}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Reveal>

          <Reveal id="activities" delay={0.06} className="scroll-mt-20">
            <div className="flex items-end justify-between gap-6">
              <div>
                <h2 className="font-display text-3xl font-semibold tracking-[-0.02em]">Recent activities</h2>
                <p className="mt-2 text-[15px] text-muted-foreground">Moments from our community outreach and empowerment programs.</p>
              </div>
              <Link href="/impact" className="shrink-0 text-[15px] font-medium text-primary underline-offset-4 hover:underline">
                All activities
              </Link>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3">
              {activities.map((a) => (
                <div key={a} className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
                  <Image
                    src={a}
                    alt="ORA activity"
                    fill
                    sizes="(max-width:1024px) 50vw, 25vw"
                    className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
                  />
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[#0d0016] text-white">
        <div className="container grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo mark="light" />
            <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-white/60">Empowering every cycle. Building healthier communities.</p>
            <SocialLinks className="mt-6" itemClassName="bg-white/[0.06] text-white/75 hover:bg-white/10 hover:text-white" iconClassName="size-4" />
          </div>

          <div>
            <h4 className="text-[15px] font-medium">Get in touch</h4>
            <ul className="mt-4 space-y-4 text-[15px]">
              <li>
                <a href={ORA_CONTACT.phoneHref} aria-label="Call ORA customer care" className="group flex items-start gap-3">
                  <Phone className="mt-0.5 size-4 shrink-0 text-white/50" strokeWidth={1.5} aria-hidden="true" />
                  <span>
                    <span className="block text-[13px] text-white/50">Customer care</span>
                    <span className="text-white/90 transition-colors group-hover:text-white">{ORA_CONTACT.phoneDisplay}</span>
                  </span>
                </a>
              </li>
              <li>
                <a href={ORA_CONTACT.emailHref} aria-label="Email ORA" className="group flex items-start gap-3">
                  <Mail className="mt-0.5 size-4 shrink-0 text-white/50" strokeWidth={1.5} aria-hidden="true" />
                  <span>
                    <span className="block text-[13px] text-white/50">Email</span>
                    <span className="text-white/90 transition-colors group-hover:text-white">{ORA_CONTACT.email}</span>
                  </span>
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-[15px] font-medium">Quick links</h4>
            <ul className="mt-4 space-y-3 text-[15px] text-white/60">
              {[["Home", "/"], ["Impact", "/impact"], ["Products", "#products"], ["Education", "/education"], ["Contact", "/contact"]].map(([l, h]) => (
                <li key={l}><Link href={h} className="transition-colors hover:text-white">{l}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-[15px] font-medium">Get involved</h4>
            <ul className="mt-4 space-y-3 text-[15px] text-white/60">
              {[["Our impact", "/impact"], ["Find ORA", "/find-ora"], ["Join us", "/login"], ["Sign in", "/login"]].map(([l, h]) => (
                <li key={l}><Link href={h} className="transition-colors hover:text-white">{l}</Link></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-white/[0.08]">
          <div className="container flex flex-col gap-2 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-[13px] text-white/45 sm:flex-row sm:justify-between">
            <p>© {new Date().getFullYear()} ORA-Pads. All rights reserved.</p>
            <p>Empowering every cycle · made in Tanzania</p>
          </div>
        </div>
      </footer>
    </>
  );
}
