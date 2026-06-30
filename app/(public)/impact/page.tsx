import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  Quote,
  Sparkles,
  Camera,
  GraduationCap,
  Truck,
  Heart,
  ArrowRight,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { cn, formatNumber } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";
import { CountUp } from "@/components/ui/count-up";
import { PhotoGallery } from "@/components/public/photo-gallery";
import { getPublicImpactStats } from "@/lib/stats";

export const metadata: Metadata = {
  title: "Impact",
  description:
    "ORA is a movement to end period poverty in Tanzania — not a shop. See the change we're making, in lives, schools and communities.",
};

const story = [
  {
    eyebrow: "Why we exist",
    icon: GraduationCap,
    title: "No girl should miss school because of her period",
    body: "Across Tanzania, period poverty keeps girls out of class for days every month — falling behind, losing confidence, sometimes dropping out for good. ORA was born to change that story, one cycle at a time.",
    img: "/ora/event/e17.jpg",
  },
  {
    eyebrow: "What we do",
    icon: Truck,
    title: "Pads, education and dignity — delivered where they're needed",
    body: "Hand in hand with partners and agents across the country, we run judgement-free menstrual-health education in schools and put real pads into real hands — community by community, school by school.",
    img: "/ora/event/e40.jpg",
  },
  {
    eyebrow: "Why we're different",
    icon: Heart,
    title: "We don't focus on selling. We focus on impact.",
    body: "Every decision we make begins with one question: will this reach more girls? We measure success in classrooms filled and confidence restored — never in units sold. That is the difference a movement makes.",
    img: "/ora/event/e09.jpg",
  },
];

const galleryPhotos = [
  "e02", "e06", "e08", "e10", "e15", "e20", "e21", "e23",
  "e27", "e28", "e30", "e31", "e32", "e34", "e36", "e39",
].map((e) => `/ora/event/${e}.jpg`);

export default async function ImpactPage() {
  const [stories, stats] = await Promise.all([
    prisma.impactStory.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    getPublicImpactStats(),
  ]);

  const headline = [
    { label: "Pads distributed", value: stats.padsDistributed, suffix: "+" },
    { label: "Lives reached", value: stats.livesReached, suffix: "+" },
    { label: "Communities reached", value: stats.communities, suffix: "+" },
    { label: "Active partners", value: stats.partners, suffix: "" },
  ];

  return (
    <div>
      {/* Mission hero */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-secondary/40 to-transparent">
        <div className="container grid items-center gap-10 py-16 lg:grid-cols-2">
          <Reveal>
            <Badge variant="accent" className="gap-1.5">
              <Sparkles className="size-3.5" />
              Our impact
            </Badge>
            <h1 className="mt-4 font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
              Dignity, measured in{" "}
              <span className="text-gradient">lives changed</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              ORA isn&apos;t a shop — it&apos;s a movement. We exist to end
              period poverty in Tanzania: keeping girls in school, with dignity,
              not for profit. Here&apos;s the change we&apos;re making together.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/donate"
                className={cn(buttonVariants({ size: "lg" }), "rounded-full")}
              >
                <Heart className="size-5" />
                Power the mission
              </Link>
              <Link
                href="/request-access"
                className={cn(
                  buttonVariants({ size: "lg", variant: "outline" }),
                  "rounded-full",
                )}
              >
                Join us
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl shadow-soft ring-1 ring-border sm:aspect-[5/4]">
              <Image
                src="/ora/event/e40.jpg"
                alt="ORA distributing pads to schoolgirls in Tanzania"
                fill
                priority
                sizes="(max-width:1024px) 100vw, 50vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6">
                <div className="font-display text-3xl font-bold text-white">
                  <CountUp value={stats.padsDistributed} suffix="+" />
                </div>
                <p className="text-sm text-white/80">
                  pads delivered straight to girls who need them
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Impact numbers */}
      <section className="container py-14">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {headline.map((h, i) => (
            <Reveal key={h.label} delay={i * 0.08}>
              <div className="glass-card h-full rounded-2xl p-6 text-center">
                <div className="font-display text-4xl font-bold text-primary">
                  <CountUp value={h.value} suffix={h.suffix} />
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {h.label}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* The story — alternating text + photo */}
      <section className="container space-y-16 py-10 sm:space-y-24">
        {story.map((s, i) => (
          <div
            key={s.title}
            className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14"
          >
            <Reveal className={i % 2 === 1 ? "lg:order-2" : ""}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-soft ring-1 ring-border">
                <Image
                  src={s.img}
                  alt={s.title}
                  fill
                  sizes="(max-width:1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            </Reveal>
            <Reveal
              delay={0.1}
              className={i % 2 === 1 ? "lg:order-1" : ""}
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                <s.icon className="size-4" />
                {s.eyebrow}
              </span>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                {s.title}
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </Reveal>
          </div>
        ))}
      </section>

      {/* Moments from the field */}
      <section className="container py-16">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Badge variant="accent" className="mx-auto gap-1.5">
            <Camera className="size-3.5" />
            ORA in action
          </Badge>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Moments from the field
          </h2>
          <p className="mt-3 text-muted-foreground">
            Every photo is a real ORA outreach — dignity reaching schools and
            communities across Tanzania.
          </p>
        </Reveal>
        <div className="mt-10">
          <PhotoGallery
            photos={galleryPhotos}
            alt="ORA school outreach in Tanzania"
          />
        </div>
      </section>

      {/* Voices from the community */}
      {stories.length > 0 && (
        <section className="container pb-16">
          <Reveal className="mb-8">
            <h2 className="font-display text-3xl font-bold tracking-tight">
              Voices from the community
            </h2>
            <p className="mt-2 text-muted-foreground">
              The people behind the numbers.
            </p>
          </Reveal>
          <div className="grid gap-6 md:grid-cols-2">
            {stories.map((s) => (
              <Card key={s.id} className="overflow-hidden">
                <CardContent className="p-7">
                  <Quote className="size-7 text-accent" />
                  {s.quote && (
                    <p className="mt-3 text-lg font-medium leading-relaxed">
                      “{s.quote}”
                    </p>
                  )}
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    {s.body}
                  </p>
                  <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                    <div>
                      <p className="font-semibold">{s.personName ?? s.title}</p>
                      {s.location && (
                        <p className="text-sm text-muted-foreground">
                          {s.location}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {s.padsDistributed ? (
                        <Badge variant="secondary">
                          {formatNumber(s.padsDistributed)} pads
                        </Badge>
                      ) : null}
                      {s.livesReached ? (
                        <Badge variant="success">
                          {formatNumber(s.livesReached)} reached
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Be part of the change */}
      <section className="container pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-accent p-8 text-center text-white sm:p-12">
          <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/15 blur-2xl" />
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            Be part of the change
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-white/85">
            Every donation and every partner helps us reach one more girl, one
            more school, one more community.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/donate"
              className={cn(
                buttonVariants({ size: "lg" }),
                "rounded-full bg-white text-primary hover:bg-white/90",
              )}
            >
              <Heart className="size-5" />
              Donate now
            </Link>
            <Link
              href="/request-access"
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "rounded-full border-white/40 bg-white/10 text-white hover:bg-white/20",
              )}
            >
              Join us
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
