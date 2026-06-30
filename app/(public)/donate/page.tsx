import type { Metadata } from "next";
import Image from "next/image";
import { Truck, HeartHandshake, GraduationCap, Sparkles } from "lucide-react";
import { prisma } from "@/lib/db";
import { getPublicImpactStats } from "@/lib/stats";
import { getDonationFeed } from "@/lib/services/donation-feed";
import { DonationForm } from "@/components/public/donation-form";
import { LiveDonationFeed } from "@/components/public/live-donation-feed";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";
import { CountUp } from "@/components/ui/count-up";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Donate",
  description:
    "Donate pads or funds to power menstrual dignity. Guest donations welcome — no account needed.",
};

export const dynamic = "force-dynamic";

const benefits = [
  {
    icon: HeartHandshake,
    title: "Straight to girls who need it",
    body: "Your gift reaches schools and villages across Tanzania.",
  },
  {
    icon: GraduationCap,
    title: "Keep girls in school",
    body: "From one pack to a whole classroom, every gift protects a girl's education.",
  },
  {
    icon: Truck,
    title: "Pads or funds",
    body: "Give pads or money — both become real protection, in real hands.",
  },
];

export default async function DonatePage() {
  const [packages, stats, feed] = await Promise.all([
    prisma.donationPackage.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    getPublicImpactStats(),
    getDonationFeed(),
  ]);

  return (
    <div className="container py-16">
      <Reveal className="mx-auto max-w-2xl text-center">
        <Badge variant="accent" className="mx-auto gap-1.5">
          <Sparkles className="size-3.5" />
          Every gift counts
        </Badge>
        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Power dignity with <span className="text-gradient">your donation</span>
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Choose a package or give a custom amount — every gift turns into real
          pads in the hands of girls who need them most.
        </p>
      </Reveal>

      {/* One live number */}
      <Reveal className="mx-auto mt-10 max-w-md">
        <div className="glass-card rounded-3xl p-7 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            Raised so far
          </p>
          <div className="mt-1 font-display text-5xl font-bold tracking-tight text-gradient">
            <CountUp value={stats.moneyDonated} prefix="TSh " />
          </div>
          <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-success" />
            Live · {formatNumber(stats.girlsReached)} girls reached and counting
          </p>
        </div>
      </Reveal>

      {/* Live donation feed — gifts pop in as they arrive */}
      <Reveal className="mx-auto mt-8 max-w-3xl">
        <LiveDonationFeed initial={feed} showCounters />
      </Reveal>

      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <Reveal className="space-y-6">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-soft ring-1 ring-border">
            <Image
              src="/ora/event/e40.jpg"
              alt="ORA reaching girls in Tanzania"
              fill
              sizes="(max-width:1024px) 100vw, 40vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
            <p className="absolute inset-x-4 bottom-3 font-medium text-white">
              Your gift, in real hands.
            </p>
          </div>

          {benefits.map((b) => (
            <div key={b.title} className="flex gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <b.icon className="size-5" />
              </span>
              <div>
                <h3 className="font-semibold">{b.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{b.body}</p>
              </div>
            </div>
          ))}
        </Reveal>

        <Reveal delay={0.1}>
          <div className="glass-card rounded-3xl p-6 sm:p-8">
            <DonationForm
              packages={packages.map((p) => ({
                id: p.id,
                name: p.name,
                description: p.description,
                type: p.type,
                amount: p.amount,
                padsQuantity: p.padsQuantity,
              }))}
            />
          </div>
        </Reveal>
      </div>
    </div>
  );
}
